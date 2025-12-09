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
  const [count, sides] = notation.split('d').map(Number);
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
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
  isCombatActive: z.boolean().default(false),
});

type GameState = z.infer<typeof gameStateSchema>;

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
  const playerDmgRoll = rollDice(playerDmgDice);

  // 2. DETERMINE MONSTER RETALIATION
  // We roll for the monster here in JS so the AI can't cheat the math
  const activeMonster = currentState.nearbyEntities.find(e => e.status === 'alive');
  let monsterAttackRoll = 0;
  let monsterDmgRoll = 0;
  
  if (activeMonster) {
    monsterAttackRoll = Math.floor(Math.random() * 20) + 1 + activeMonster.attackBonus;
    monsterDmgRoll = rollDice(activeMonster.damageDice);
  }

  const d20 = Math.floor(Math.random() * 20) + 1; // Player Hit Roll
  
  // @ts-ignore
  const currentActData = STORY_ACTS[currentState.storyAct] || STORY_ACTS[0];
  const { desc: roomDesc, registry: roomReg } = await resolveRoomDescription(currentState);
  currentState.roomRegistry = roomReg; 

  // 3. GENERATE STATE
  const { object: newState } = await generateObject({
    model: groq(MODEL_LOGIC), 
    schema: gameStateSchema,
    mode: 'json', 
    system: `
      You are the Dungeon Master Engine.
      SETTING: Medieval Fantasy.
      
      INPUT DATA:
      - Player Weapon: ${weaponName} (Dmg: ${playerDmgDice} -> Rolled: ${playerDmgRoll})
      - Player Attack Roll: ${d20}
      - Monster: ${activeMonster ? activeMonster.name : "None"}
      - Monster Attack Roll: ${monsterAttackRoll} (vs Player AC ${currentState.ac})
      - Monster Damage Roll: ${monsterDmgRoll}
      
      COMBAT RULES (STRICT):
      1. DETECT INTENT: 
         - If user says "Attack", "Hit", "Strike": It is an ATTACK.
         - If user says "Defend", "Block", "Dodge": It is DEFENSE. Set 'tempAcBonus' = 4. Do NOT attack monster.
         - If user says "Run", "Flee": Attempt to clear 'nearbyEntities' or change 'location'.
      
      2. RESOLVE PLAYER ACTION:
         - IF ATTACK: Compare ${d20} vs Monster AC. If Hit, subtract ${playerDmgRoll} from Monster HP.
         - IF DEFENSE: Player deals 0 damage, but gains AC bonus.
      
      3. RESOLVE MONSTER RETALIATION (Automatic):
         - IF Monster is alive AND Player did not flee:
         - Compare ${monsterAttackRoll} vs (Player AC + tempAcBonus).
         - IF HIT: Subtract ${monsterDmgRoll} from PLAYER HP.
         - IF MISS: Player takes 0 damage.
      
      4. UPDATE SUMMARY:
         - Combine both actions. 
         - E.g., "You hit Rat for 3 dmg. Rat bit you for 2 dmg."
         - E.g., "You blocked the Rat's bite (AC boosted)."
      
      5. STATUS:
         - If Monster HP <= 0, status='dead', isCombatActive=false.
         - If Player HP <= 0, Game Over.
         - If Monster is alive, isCombatActive=true.
    `,
    prompt: `State: ${JSON.stringify(currentState)} Action: "${userAction}"`,
  });

  // Reset temp AC bonus after turn calculation
  newState.tempAcBonus = 0;

  const { url, registry: imgReg } = resolveSceneImage(newState);
  const { desc: finalDesc, registry: textReg } = await resolveRoomDescription(newState);
  
  newState.currentImage = url;
  newState.sceneRegistry = imgReg;
  newState.roomRegistry = textReg;

  return { newState, roomDesc: finalDesc };
}

// --- EXPORT 1: CREATE NEW GAME ---
export async function createNewGame(): Promise<GameState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { data: existingSave } = await supabase.from('saved_games').select('game_state').eq('user_id', user.id).single();
  if (existingSave) return existingSave.game_state as unknown as GameState;

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
    isCombatActive: true // Start in combat if monster is there
  };

  const { url, registry } = resolveSceneImage(initialState);
  initialState.currentImage = url;
  initialState.sceneRegistry = registry;

  await supabase.from('saved_games').upsert({ user_id: user.id, game_state: initialState }, { onConflict: 'user_id' });
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
  await supabase.from('saved_games').upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });

  const stream = createStreamableValue('');
  
  (async () => {
    const { textStream } = await streamText({
      model: groq(MODEL_NARRATOR), 
      temperature: 0.6,
      onFinish: async ({ text }) => {
        const updatedHistory = [...newState.narrativeHistory, text].slice(-3); 
        newState.narrativeHistory = updatedHistory;
        await supabase.from('saved_games').upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });
      },
      system: `
        You are a Text Adventure Interface.
        MODE: ${narrativeMode}
        
        DATA:
        - PLAYER HP: ${newState.hp} / ${newState.maxHp}
        - EVENT: "${newState.lastActionSummary}"
        - ENTITY STATUS: "${visibleEntities}"
        
        RULES:
        1. IF PLAYER TOOK DAMAGE: Describe the pain/wound vividly.
        2. IF PLAYER BLOCKED: Describe the defensive stance deflection.
        3. IF MONSTER ATTACKED: Make sure to mention the monster striking back.
        4. IF MONSTER DIED: Describe the kill.
        5. Keep it fast-paced.
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
    isCombatActive: true
  };

  const { url, registry } = resolveSceneImage(freshState);
  freshState.currentImage = url;
  freshState.sceneRegistry = registry;

  await supabase.from('saved_games').upsert({ user_id: user.id, game_state: freshState }, { onConflict: 'user_id' });
  return freshState;
}
