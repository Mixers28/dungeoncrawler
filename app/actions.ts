'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamText } from 'ai';
import { createStreamableValue } from 'ai/rsc';
import { z } from 'zod';
import { createClient } from '../utils/supabase/server';
import { MONSTER_MANUAL, WEAPON_TABLE, STORY_ACTS, KEY_ITEMS } from '../lib/rules';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL_LOGIC = 'meta-llama/llama-4-scout-17b-16e-instruct';
const MODEL_NARRATOR = 'llama-3.3-70b-versatile'; 

// --- HELPERS ---
function rollDice(notation: string): number {
  // Supports expressions like "1d6+2" or "1d4+1d6"
  const tokens = notation.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  if (tokens.length === 0) throw new Error(`Invalid dice expression: "${notation}"`);

  let total = 0;

  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[-+]/, '');

    if (body.includes('d')) {
      const [countStr, facesStr] = body.split('d');
      const count = countStr ? Number(countStr) : 1;
      const faces = Number(facesStr);
      if (!Number.isFinite(count) || !Number.isFinite(faces) || count <= 0 || faces <= 0) {
        throw new Error(`Invalid dice term: "${token}"`);
      }
      for (let i = 0; i < count; i++) {
        total += sign * (Math.floor(Math.random() * faces) + 1);
      }
    } else {
      const flat = Number(body);
      if (!Number.isFinite(flat)) throw new Error(`Invalid modifier: "${token}"`);
      total += sign * flat;
    }
  }

  return total;
}

function getRandomScenario(act: number) {
  const allMobs = Object.keys(MONSTER_MANUAL);
  const mobName = allMobs[Math.floor(Math.random() * allMobs.length)];
  const stats = MONSTER_MANUAL[mobName];
  const LOCATIONS = ["Damp Hallway", "Collapsed Tunnel", "Forgotten Shrine", "Mess Hall", "Torture Chamber"];
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  
  // Return stats so we can populate the new schema fields
  return { loc, mob: mobName, desc: stats.desc, hp: stats.hp, maxHp: stats.hp, ac: stats.ac, atk: stats.attackBonus, dmg: stats.damage };
}

// --- SCHEMAS (Use Import or Redefine) ---
// Note: In a real app, import these from lib/game-schema
// For this single-file paste, I am redefining to ensure no errors.
const itemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(7)),
  name: z.string(),
  type: z.enum(['weapon', 'armor', 'potion', 'scroll', 'misc', 'food', 'material', 'key']),
  quantity: z.coerce.number().int(),
});
const questSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  description: z.string(),
});
const entitySchema = z.object({
  name: z.string(),
  status: z.string().default('alive'), 
  description: z.string().optional(),
  hp: z.coerce.number().int().default(10),
  maxHp: z.coerce.number().int().default(10),
  ac: z.coerce.number().int().default(10),
  attackBonus: z.coerce.number().int().default(2), 
  damageDice: z.string().default("1d4"),
});
const gameStateSchema = z.object({
  hp: z.coerce.number().int(),
  maxHp: z.coerce.number().int(),
  ac: z.coerce.number().int(),
  tempAcBonus: z.coerce.number().int().default(0),
  gold: z.coerce.number().int(),
  location: z.string(),
  inventory: z.array(itemSchema).default([]), 
  quests: z.array(questSchema).default([]),
  nearbyEntities: z.array(entitySchema).default([]),
  lastActionSummary: z.string(),
  worldSeed: z.coerce.number().int().default(() => Math.floor(Math.random() * 999999)),
  narrativeHistory: z.array(z.string()).default([]),
  storyAct: z.coerce.number().int().default(0), 
  roomRegistry: z.record(z.string()).default({}), 
  sceneRegistry: z.record(z.string()).default({}), 
  currentImage: z.string().optional(),
  lastRolls: z.object({
    playerAttack: z.coerce.number().int().default(0),
    playerDamage: z.coerce.number().int().default(0),
    monsterAttack: z.coerce.number().int().default(0),
    monsterDamage: z.coerce.number().int().default(0),
  }).default({
    playerAttack: 0,
    playerDamage: 0,
    monsterAttack: 0,
    monsterDamage: 0,
  }),
  isCombatActive: z.boolean().default(false),
});

type GameState = z.infer<typeof gameStateSchema>;
type ActionIntent = 'attack' | 'defend' | 'run' | 'other';

async function hydrateState(rawState: unknown): Promise<GameState> {
  const parsed = gameStateSchema.safeParse(rawState);
  if (!parsed.success) {
    throw new Error("Saved game is incompatible with the current version.");
  }
  const state = parsed.data;

  // Rebuild derived assets when missing
  const { url, registry: sceneRegistry } = resolveSceneImage(state);
  state.currentImage = url;
  state.sceneRegistry = sceneRegistry;

  const { registry: roomRegistry } = await resolveRoomDescription(state);
  state.roomRegistry = roomRegistry;

  return state;
}

// --- RESOLVERS ---
function resolveSceneImage(state: GameState): { url: string; registry: Record<string, string> } {
  const activeThreat = state.nearbyEntities.find(e => e.status !== 'dead' && e.status !== 'object');
  const sceneKey = activeThreat ? `${state.location}|${activeThreat.name}` : state.location;
  if (state.sceneRegistry && state.sceneRegistry[sceneKey]) {
    return { url: state.sceneRegistry[sceneKey], registry: state.sceneRegistry };
  }
  let visualPrompt = state.location;
  if (activeThreat) visualPrompt = `A terrifying ${activeThreat.name} inside ${state.location}`;
  const subjectHash = visualPrompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const stableSeed = subjectHash + (state.worldSeed || 0); 
  const encodedPrompt = encodeURIComponent(visualPrompt + " fantasy oil painting style dark gritty 8k");
  const newUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=300&nologo=true&seed=${stableSeed}`;
  return { url: newUrl, registry: { ...state.sceneRegistry, [sceneKey]: newUrl } };
}

async function resolveRoomDescription(state: GameState): Promise<{ desc: string, registry: Record<string, string> }> {
  if (state.roomRegistry && state.roomRegistry[state.location]) {
    return { desc: state.roomRegistry[state.location], registry: state.roomRegistry };
  }
  const { object: roomData } = await generateObject({
    model: groq(MODEL_LOGIC),
    schema: z.object({ description: z.string() }),
    system: `Describe room: "${state.location}". MEDIEVAL FANTASY. Max 15 words. Concrete details.`,
    prompt: `Generate description.`,
  });
  const newRegistry = { ...state.roomRegistry, [state.location]: roomData.description };
  return { desc: roomData.description, registry: newRegistry };
}

function getActionIntent(userAction: string): ActionIntent {
  const action = userAction.toLowerCase();
  if (/(attack|hit|strike|stab|slash|shoot|swing|bash)/.test(action)) return 'attack';
  if (/(defend|block|dodge|parry|guard|brace)/.test(action)) return 'defend';
  if (/(run|flee|escape|retreat)/.test(action)) return 'run';
  return 'other';
}

// --- MAIN LOGIC ENGINE ---
async function _updateGameState(currentState: GameState, userAction: string) {
  // 1. DETERMINE PLAYER WEAPON & DAMAGE
  let playerDmgDice = "1d4"; // Default Fists
  let weaponName = "Fists";
  const weapon = currentState.inventory.find(i => i.type === 'weapon');
  if (weapon) {
    weaponName = weapon.name;
    playerDmgDice = WEAPON_TABLE[weapon.name] || "1d4";
  }

  const actionIntent = getActionIntent(userAction);

  // 2. PREP STATE
  const newState: GameState = {
    ...currentState,
    inventory: currentState.inventory.map(i => ({ ...i })),
    quests: currentState.quests.map(q => ({ ...q })),
    nearbyEntities: currentState.nearbyEntities.map(e => ({ ...e })),
    roomRegistry: { ...currentState.roomRegistry },
    sceneRegistry: { ...currentState.sceneRegistry },
    tempAcBonus: 0,
    narrativeHistory: [...(currentState.narrativeHistory || [])],
  };

  // 3. ACTIVE MONSTER CONTEXT
  const activeMonsterIndex = newState.nearbyEntities.findIndex(e => e.status === 'alive');
  const activeMonster = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;

  // 4. PLAYER TURN
  let playerAttackRoll = 0;
  let playerDamageRoll = 0;
  const summaryParts: string[] = [];

  if (actionIntent === 'attack' && activeMonster) {
    playerAttackRoll = Math.floor(Math.random() * 20) + 1; // no bonus for now
    if (playerAttackRoll >= activeMonster.ac) {
      playerDamageRoll = rollDice(playerDmgDice);
      const updatedHp = Math.max(0, activeMonster.hp - playerDamageRoll);
      newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
        idx === activeMonsterIndex
          ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
          : entity
      );
      summaryParts.push(`You hit ${activeMonster.name} for ${playerDamageRoll} damage (roll ${playerAttackRoll} vs AC ${activeMonster.ac}).`);
    } else {
      summaryParts.push(`You miss ${activeMonster.name} (roll ${playerAttackRoll} vs AC ${activeMonster.ac}).`);
    }
  } else if (actionIntent === 'defend') {
    newState.tempAcBonus = 4;
    summaryParts.push("You brace for impact, raising your guard.");
  } else if (actionIntent === 'run') {
    newState.nearbyEntities = [];
    newState.isCombatActive = false;
    summaryParts.push("You flee the encounter.");
  } else {
    summaryParts.push(`You ${userAction}.`);
  }

  // 5. MONSTER TURN (only if still present and player didn't run)
  let monsterAttackRoll = 0;
  let monsterDamageRoll = 0;
  let monsterDamageNotation = "";
  const monsterStillAlive = activeMonster && newState.nearbyEntities.find(e => e.name === activeMonster.name && e.status === 'alive');
  const monsterIsActive = newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend';
  if (monsterStillAlive && monsterIsActive && actionIntent !== 'run') {
    monsterAttackRoll = Math.floor(Math.random() * 20) + 1 + activeMonster.attackBonus;
    monsterDamageNotation = activeMonster.damageDice;
    const playerAc = currentState.ac + newState.tempAcBonus;
    if (monsterAttackRoll >= playerAc) {
      monsterDamageRoll = rollDice(monsterDamageNotation);
      newState.hp = Math.max(0, currentState.hp - monsterDamageRoll);
      summaryParts.push(`${activeMonster.name} hits you for ${monsterDamageRoll} damage (roll ${monsterAttackRoll} vs AC ${playerAc}).`);
    } else {
      summaryParts.push(`${activeMonster.name} misses you (roll ${monsterAttackRoll} vs AC ${playerAc}).`);
    }
  }

  // 6. CLEANUP COMBAT FLAGS
  newState.tempAcBonus = 0;
  const anyAlive = newState.nearbyEntities.some(e => e.status === 'alive');
  newState.isCombatActive = (anyAlive && (newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend')) && newState.hp > 0;
  newState.nearbyEntities = [...newState.nearbyEntities];

  // 7. STORY ACT BOUNDS
  const maxAct = Math.max(...Object.keys(STORY_ACTS).map(Number));
  newState.storyAct = Math.min(maxAct, Math.max(0, newState.storyAct));

  // 8. SUMMARY & ROLLS
  newState.lastActionSummary = summaryParts.join(' ');
  newState.lastRolls = {
    playerAttack: playerAttackRoll,
    playerDamage: playerDamageRoll,
    monsterAttack: monsterAttackRoll,
    monsterDamage: monsterDamageRoll,
  };

  // 9. UPDATE ROOM + IMAGE REGISTRIES
  const { desc: finalDesc, registry: textReg } = await resolveRoomDescription(newState);
  newState.roomRegistry = textReg;

  const { url, registry: imgReg } = resolveSceneImage(newState);
  newState.currentImage = url;
  newState.sceneRegistry = imgReg;

  return { newState, roomDesc: finalDesc };
}

// --- EXPORT 1: CREATE NEW GAME ---
export async function createNewGame(): Promise<GameState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { data: existingSave } = await supabase.from('saved_games').select('game_state').eq('user_id', user.id).single();
  if (existingSave?.game_state) {
    const hydrated = await hydrateState(existingSave.game_state);
    const { error: updateError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: hydrated }, { onConflict: 'user_id' });
    if (updateError) console.error("Failed to update existing save:", updateError);
    return hydrated;
  }

  const start = getRandomScenario(0);
  const initialState: GameState = {
    hp: 20, maxHp: 20, ac: 10, tempAcBonus: 0, gold: 0,
    location: "The Iron Gate", 
    inventory: [{ id: '1', name: 'Rusty Dagger', type: 'weapon', quantity: 1 }],
    quests: [{ id: '1', title: 'The Awakening', status: 'active', description: 'Find the Iron Key.' }],
    // Populating with STATS from getScenario
    nearbyEntities: [{ 
        name: start.mob, 
        status: 'alive', 
        description: start.desc, 
        hp: start.hp, maxHp: start.maxHp, ac: start.ac,
        attackBonus: start.atk, damageDice: start.dmg 
    }],
    lastActionSummary: "The gates are locked. A monster guards the path.",
    worldSeed: Math.floor(Math.random() * 999999),
    narrativeHistory: [],
    sceneRegistry: {}, roomRegistry: {}, storyAct: 0, currentImage: "",
    isCombatActive: false // Start neutral; combat begins on hostile actions
  };

  const { url, registry } = resolveSceneImage(initialState);
  initialState.currentImage = url;
  initialState.sceneRegistry = registry;

  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: initialState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save new game: ${saveError.message}`);
  return initialState;
}

// --- EXPORT 2: PROCESS TURN ---
export async function processTurn(currentState: GameState, userAction: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { newState, roomDesc } = await _updateGameState(currentState, userAction);
  
  const isNewLocation = newState.location !== currentState.location;
  const isLooking = userAction.toLowerCase().includes('look') || userAction.toLowerCase().includes('search');
  const isCombat = newState.isCombatActive;
  
  let narrativeMode = "GENERAL_INTERACTION";
  if (isNewLocation) narrativeMode = "ROOM_INTRO";
  else if (isLooking) narrativeMode = "INSPECTION";
  else if (isCombat) narrativeMode = "COMBAT_FOCUS";

  const visibleEntities = newState.nearbyEntities
    .map(e => `${e.name} (${e.status}, HP:${e.hp}/${e.maxHp})`)
    .join(', ') || "None";

  newState.narrativeHistory = currentState.narrativeHistory || [];
  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save turn: ${saveError.message}`);

  const actData = STORY_ACTS[newState.storyAct] || STORY_ACTS[0];
  const locationDescription = newState.roomRegistry[newState.location] || roomDesc || "An undefined space.";

  const stream = createStreamableValue('');
  
  (async () => {
    const { textStream } = await streamText({
      model: groq(MODEL_NARRATOR), 
      temperature: 0.6,
      onFinish: async ({ text }) => {
        const updatedHistory = [...newState.narrativeHistory, text].slice(-3); 
        newState.narrativeHistory = updatedHistory;
        const { error: finishError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });
        if (finishError) console.error("Failed to save narrative update:", finishError);
      },
      system: `
        You are a Text Adventure Interface.
        MODE: ${narrativeMode}
        
        DATA:
        - PLAYER HP: ${newState.hp} / ${newState.maxHp}
        - EVENT: "${newState.lastActionSummary}"
        - ENTITY STATUS: "${visibleEntities}"
        - LOCATION: "${newState.location}" -> "${locationDescription}"
        - STORY ACT: "${actData.name}" Goal: "${actData.goal}" Clue: "${actData.clue}"
        - INVENTORY: ${newState.inventory.map(i => `${i.name} x${i.quantity}`).join(', ') || "Empty"}
        - ROLLS: playerAttack=${newState.lastRolls.playerAttack}, playerDamage=${newState.lastRolls.playerDamage}, monsterAttack=${newState.lastRolls.monsterAttack}, monsterDamage=${newState.lastRolls.monsterDamage}
        
        RULES:
        1. Keep it tight: max 3 sentences.
        2. IF PLAYER TOOK DAMAGE: Mention the wound briefly.
        3. IF PLAYER BLOCKED: Mention the deflection briefly.
        4. IF MONSTER ATTACKED: Mention the strike.
        5. IF MONSTER DIED: Mention the kill.
        6. Do not restate inventory or stats unless they changed this turn.
        7. Stay inside the provided location, entities, and act context. Do not invent new named NPCs, items, or rooms unless they already appear in state or inventory.
        8. Silently verify consistency with the provided DATA (HP, rolls, entity statuses); do not contradict it or invent new rolls/values.
      `,
      prompt: `Action: "${userAction}" Location: "${newState.location}"`,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }
    stream.done();
  })();

  return { newState, narrativeStream: stream.value };
}

// --- EXPORT 3: RESET ---
export async function resetGame() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  // Re-use createNewGame logic essentially
  const start = getRandomScenario(0);
  const freshState: GameState = {
    hp: 20, maxHp: 20, ac: 10, tempAcBonus: 0, gold: 0,
    location: "The Iron Gate",
    inventory: [{ id: '1', name: 'Rusty Dagger', type: 'weapon', quantity: 1 }],
    quests: [{ id: '1', title: 'The Awakening', status: 'active', description: 'Find the Iron Key.' }],
    nearbyEntities: [{ 
        name: start.mob, status: 'alive', description: start.desc, 
        hp: start.hp, maxHp: start.maxHp, ac: start.ac,
        attackBonus: start.atk, damageDice: start.dmg 
    }],
    lastActionSummary: "You wake up at the Iron Gate.",
    worldSeed: Math.floor(Math.random() * 999999),
    narrativeHistory: [],
    sceneRegistry: {}, roomRegistry: {}, storyAct: 0, currentImage: "",
    isCombatActive: false
  };

  const { url, registry } = resolveSceneImage(freshState);
  freshState.currentImage = url;
  freshState.sceneRegistry = registry;

  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: freshState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to reset game: ${saveError.message}`);
  return freshState;
}
