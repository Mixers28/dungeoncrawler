'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import fs from 'fs/promises';
import path from 'path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { savedGames } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { gameStateSchema, type GameState } from '../lib/game-schema';
import { MONSTER_MANUAL, WEAPON_TABLE, STORY_ACTS, EASY_MOBS } from '../lib/rules';
import { buildRulesReferenceSnippet } from '../lib/refs';
import { ARCHETYPES } from './characters';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL_NARRATOR = 'llama-3.3-70b-versatile';

// --- HELPERS ---
function rollDice(notation: string): number {
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
  const actMobs = act === 0 ? EASY_MOBS : Object.keys(MONSTER_MANUAL).filter(m => m !== 'Iron King');
  const mobName = actMobs[Math.floor(Math.random() * actMobs.length)];
  const stats = MONSTER_MANUAL[mobName];
  const LOCATIONS = ["Damp Hallway", "Collapsed Tunnel", "Forgotten Shrine", "Mess Hall", "Torture Chamber"];
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  return { loc, mob: mobName, desc: stats.desc, hp: stats.hp, maxHp: stats.hp, ac: stats.ac, atk: stats.attackBonus, dmg: stats.damage };
}

type ActionIntent = 'attack' | 'defend' | 'run' | 'other';

function getActionIntent(userAction: string): ActionIntent {
  const action = userAction.toLowerCase();
  if (/(attack|hit|strike|stab|slash|shoot|swing|bash)/.test(action)) return 'attack';
  if (/(defend|block|dodge|parry|guard|brace)/.test(action)) return 'defend';
  if (/(run|flee|escape|retreat)/.test(action)) return 'run';
  return 'other';
}

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000];

async function hydrateState(rawState: unknown): Promise<GameState> {
  const parsed = gameStateSchema.safeParse(rawState);
  if (!parsed.success) {
    throw new Error("Saved game is incompatible with the current version.");
  }
  const state = parsed.data;

  const { url, registry: sceneRegistry } = await resolveSceneImage(state);
  state.currentImage = url;
  state.sceneRegistry = sceneRegistry;

  const { registry: roomRegistry } = await resolveRoomDescription(state);
  state.roomRegistry = roomRegistry;

  return state;
}

// --- RESOLVERS ---
async function ensureCacheDir() {
  const cacheDir = path.join(process.cwd(), 'public', 'scene-cache');
  await fs.mkdir(cacheDir, { recursive: true }).catch(() => null);
  return cacheDir;
}

async function cacheSceneImage(remoteUrl: string, fileName: string): Promise<string | null> {
  try {
    const cacheDir = await ensureCacheDir();
    const filePath = path.join(cacheDir, fileName);
    try {
      await fs.access(filePath);
      return `/scene-cache/${fileName}`;
    } catch {
      // not cached yet
    }
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return `/scene-cache/${fileName}`;
  } catch {
    return null;
  }
}

async function resolveSceneImage(state: GameState): Promise<{ url: string; registry: Record<string, string> }> {
  const VARIANT_POOL = 3;
  const activeThreat = state.nearbyEntities.find(e => e.status !== 'dead' && e.status !== 'object');
  const sceneKey = activeThreat ? `${state.location}|${activeThreat.name}` : state.location;
  if (state.sceneRegistry?.[sceneKey]) {
    return { url: state.sceneRegistry[sceneKey], registry: state.sceneRegistry };
  }
  const visualPrompt = activeThreat ? `A terrifying ${activeThreat.name} inside ${state.location}` : state.location;
  const subjectHash = visualPrompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variantIndex = Math.abs((state.worldSeed || 0) % VARIANT_POOL);
  const stableSeed = subjectHash + variantIndex * 9973;
  const encodedPrompt = encodeURIComponent(visualPrompt + " fantasy oil painting style dark gritty 8k");
  const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=300&nologo=true&seed=${stableSeed}`;
  const fileName = `${sceneKey.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${variantIndex}.jpg`;
  const cachedPath = await cacheSceneImage(remoteUrl, fileName);
  const finalUrl = cachedPath || remoteUrl;
  return { url: finalUrl, registry: { ...state.sceneRegistry, [sceneKey]: finalUrl } };
}

async function resolveRoomDescription(state: GameState): Promise<{ desc: string; registry: Record<string, string> }> {
  if (state.roomRegistry?.[state.location]) {
    return { desc: state.roomRegistry[state.location], registry: state.roomRegistry };
  }
  const aliveThreats = state.nearbyEntities.filter(e => e.status === 'alive').map(e => e.name);
  const desc = aliveThreats.length > 0
    ? `${state.location} with ${aliveThreats.join(', ')} nearby.`
    : `${state.location} is quiet.`;
  return { desc, registry: { ...state.roomRegistry, [state.location]: desc } };
}

// --- MAIN LOGIC ENGINE ---
async function _updateGameState(currentState: GameState, userAction: string) {
  // Sanitize input to prevent prompt injection via structural characters
  const safeAction = userAction.replace(/[|"\\]/g, '').slice(0, 200).trim();

  // 1. DETERMINE PLAYER WEAPON & DAMAGE
  let playerDmgDice = "1d4";
  let weaponName = "Fists";
  const weapon = currentState.inventory.find(i => i.type === 'weapon');
  if (weapon) {
    weaponName = weapon.name;
    playerDmgDice = WEAPON_TABLE[weapon.name] || "1d4";
  }

  const playerAttackBonus = currentState.character.attackBonus ?? 0;
  const actionIntent = getActionIntent(safeAction);

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
    locationHistory: [...(currentState.locationHistory || [])],
    inventoryChangeLog: [...(currentState.inventoryChangeLog || [])],
  };

  // 3. ACTIVE MONSTER CONTEXT
  const activeMonsterIndex = newState.nearbyEntities.findIndex(e => e.status === 'alive');
  const activeMonster = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;

  // 4. PLAYER TURN
  let playerAttackRoll = 0;
  let playerDamageRoll = 0;
  const summaryParts: string[] = [];

  const monsterWasAlive = activeMonster?.status === 'alive';

  if (actionIntent === 'attack' && activeMonster) {
    playerAttackRoll = Math.floor(Math.random() * 20) + 1 + playerAttackBonus;
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
  } else if (actionIntent === 'attack' && !activeMonster) {
    summaryParts.push("You swing, but no foe stands before you.");
  } else {
    summaryParts.push(`You ${safeAction}.`);
  }

  // 5. MONSTER TURN
  let monsterAttackRoll = 0;
  let monsterDamageRoll = 0;
  const monsterStillAlive = activeMonster && newState.nearbyEntities.find(e => e.name === activeMonster.name && e.status === 'alive');
  const monsterIsActive = newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend';
  if (monsterStillAlive && monsterIsActive && actionIntent !== 'run') {
    monsterAttackRoll = Math.floor(Math.random() * 20) + 1 + activeMonster.attackBonus;
    const playerAc = currentState.ac + newState.tempAcBonus;
    if (monsterAttackRoll >= playerAc) {
      monsterDamageRoll = rollDice(activeMonster.damageDice);
      newState.hp = Math.max(0, currentState.hp - monsterDamageRoll);
      summaryParts.push(`${activeMonster.name} hits you for ${monsterDamageRoll} damage (roll ${monsterAttackRoll} vs AC ${playerAc}).`);
    } else {
      summaryParts.push(`${activeMonster.name} misses you (roll ${monsterAttackRoll} vs AC ${playerAc}).`);
    }
  }

  // 6. CLEANUP COMBAT FLAGS
  newState.tempAcBonus = 0;
  const anyAlive = newState.nearbyEntities.some(e => e.status === 'alive');
  newState.isCombatActive = anyAlive && (newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend') && newState.hp > 0;
  newState.nearbyEntities = [...newState.nearbyEntities];

  // 6a. LOOTING / KEY RECOVERY
  const wantsKey = /(key|glint|shiny|metal|object|take|grab|pick|retrieve)/i.test(safeAction) && newState.location.toLowerCase().includes('gate');
  const hasIronKey = newState.inventory.some(i => i.name === 'Iron Key');
  if (wantsKey && !hasIronKey) {
    newState.inventory = [
      ...newState.inventory,
      { id: `key-${Date.now().toString(36)}`, name: 'Iron Key', type: 'key', quantity: 1 },
    ];
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Gained Iron Key at ${newState.location}`].slice(-10);
    summaryParts.push("You recover the Iron Key from the debris.");
    newState.nearbyEntities = newState.nearbyEntities.map(ent =>
      ent.name.toLowerCase().includes('rat')
        ? { ...ent, status: ent.status === 'alive' ? 'fleeing' : ent.status }
        : ent
    );
    newState.isCombatActive = newState.nearbyEntities.some(e => e.status === 'alive' && e.hp > 0) && newState.hp > 0;
  }

  // 6b. TRACK LOCATION HISTORY
  if (newState.location !== currentState.location) {
    newState.locationHistory = [...(newState.locationHistory || []), newState.location].slice(-10);
  }

  // 7. STORY ACT BOUNDS (floor only; no upper cap so victory state can exceed max defined act)
  newState.storyAct = Math.max(0, newState.storyAct);

  // 8. XP & LEVEL
  const monsterNow = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;
  const monsterKilled = monsterWasAlive && monsterNow?.status === 'dead';
  if (monsterKilled && activeMonster) {
    const xpAward = Math.max(25, (MONSTER_MANUAL[activeMonster.name]?.hp ?? 10) * 5);
    newState.xp += xpAward;
    summaryParts.push(`You gain ${xpAward} XP.`);
    let leveled = false;
    while (newState.level < XP_THRESHOLDS.length && newState.xp >= XP_THRESHOLDS[newState.level]) {
      newState.level += 1;
      newState.xpToNext = XP_THRESHOLDS[newState.level] ?? newState.xpToNext;
      newState.maxHp += 2;
      newState.hp = Math.max(newState.hp, newState.maxHp);
      leveled = true;
    }
    if (leveled) summaryParts.push(`You reach level ${newState.level}.`);
  }

  // 8b. LOOT CORPSES
  const wantsLoot = /(loot|search|rummage|pick over|salvage)/i.test(safeAction);
  const deadCorpse = newState.nearbyEntities.find(e => e.status === 'dead' && !e.name.toLowerCase().includes('looted'));
  if (wantsLoot && deadCorpse) {
    const goldFind = Math.max(1, Math.floor(Math.random() * 6));
    newState.gold += goldFind;
    const trophyName = `${deadCorpse.name} Remnant`;
    newState.inventory = [...newState.inventory, { id: `loot-${Date.now().toString(36)}`, name: trophyName, type: 'misc', quantity: 1 }];
    newState.nearbyEntities = newState.nearbyEntities.map(e =>
      e === deadCorpse ? { ...e, name: `${e.name} (looted)` } : e
    );
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Looted ${deadCorpse.name}: +${goldFind} gold, +${trophyName}`].slice(-10);
    summaryParts.push(`You loot the ${deadCorpse.name}, gaining ${goldFind} gold and a ${trophyName}.`);
  }

  // 9. STORY ACT ADVANCEMENT
  if (newState.storyAct === 0 && newState.inventory.some(i => i.name === 'Iron Key')) {
    newState.storyAct = 1;
    newState.quests = newState.quests.map(q =>
      q.id === '1' ? { ...q, status: 'completed' } : q
    );
    newState.quests.push({ id: '2', title: 'The Deep Descent', status: 'active', description: 'Find the Cursed Crown in the armory.' });
    summaryParts.push("The inner sanctum stirs. A new path opens.");
  }
  if (newState.storyAct === 1 && newState.inventory.some(i => i.name === 'Cursed Crown')) {
    newState.storyAct = 2;
    newState.quests = newState.quests.map(q =>
      q.id === '2' ? { ...q, status: 'completed' } : q
    );
    newState.quests.push({ id: '3', title: "The King's Fall", status: 'active', description: "Destroy the Iron King's Ghost in the throne room." });
    summaryParts.push("The crown is cold in your hands. The throne room awaits.");
  }
  if (newState.storyAct === 2 && monsterKilled && activeMonster?.name === 'Iron King') {
    newState.storyAct = 3;
    newState.quests = newState.quests.map(q =>
      q.id === '3' ? { ...q, status: 'completed' } : q
    );
    summaryParts.push("The Iron King dissolves into cold smoke. The curse is broken.");
  }

  // 10. SUMMARY & ROLLS
  newState.lastActionSummary = summaryParts.join(' ').trim() || "Nothing of note happens.";
  newState.lastRolls = {
    playerAttack: playerAttackRoll,
    playerDamage: playerDamageRoll,
    monsterAttack: monsterAttackRoll,
    monsterDamage: monsterDamageRoll,
  };

  // 11. UPDATE ROOM + IMAGE REGISTRIES
  const { desc: finalDesc, registry: textReg } = await resolveRoomDescription(newState);
  newState.roomRegistry = textReg;

  const { url, registry: imgReg } = await resolveSceneImage(newState);
  newState.currentImage = url;
  newState.sceneRegistry = imgReg;

  return { newState, roomDesc: finalDesc };
}

// --- EXPORT 1: CREATE NEW GAME ---
type CreateOptions = { archetypeKey?: keyof typeof ARCHETYPES; forceNew?: boolean };

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("You must be logged in.");

  const archetypeKey = opts?.archetypeKey ?? 'fighter';
  const forceNew = opts?.forceNew ?? false;

  const [existingSave] = await db.select().from(savedGames).where(eq(savedGames.userId, userId)).limit(1);

  if (existingSave?.gameState && !forceNew) {
    const hydrated = await hydrateState(existingSave.gameState);
    await db.insert(savedGames)
      .values({ userId, gameState: hydrated as unknown as Record<string, unknown>, updatedAt: new Date() })
      .onConflictDoUpdate({ target: savedGames.userId, set: { gameState: hydrated as unknown as Record<string, unknown>, updatedAt: new Date() } });
    return hydrated;
  }

  const start = getRandomScenario(0);
  const archetype = ARCHETYPES[archetypeKey] ?? ARCHETYPES.fighter;

  const startingWeapon = archetype.startingWeapon || 'Rusty Dagger';
  const startingArmor = archetype.startingArmor;
  const baseAc = 10 + (archetype.acBonus || 0);
  const baseHp = 20 + (archetype.hpBonus || 0);

  const initialState: GameState = {
    hp: baseHp, maxHp: baseHp, ac: baseAc, tempAcBonus: 0, gold: 0,
    level: 1, xp: 0, xpToNext: XP_THRESHOLDS[1],
    character: {
      name: 'Adventurer',
      class: archetype.label,
      background: archetype.background,
      acBonus: archetype.acBonus,
      hpBonus: archetype.hpBonus,
      attackBonus: archetype.attackBonus,
      startingWeapon,
      startingArmor: startingArmor || undefined,
      archetypeKey,
    },
    location: "The Iron Gate",
    inventory: [
      { id: '1', name: startingWeapon, type: 'weapon', quantity: 1 },
      ...(startingArmor ? [{ id: 'armor-1', name: startingArmor, type: 'armor' as const, quantity: 1 }] : []),
    ],
    quests: [{ id: '1', title: 'The Awakening', status: 'active', description: 'Find the Iron Key.' }],
    nearbyEntities: [{
      name: start.mob,
      status: 'alive',
      description: start.desc,
      hp: start.hp, maxHp: start.maxHp, ac: start.ac,
      attackBonus: start.atk, damageDice: start.dmg,
    }],
    lastActionSummary: "The gates are locked. A monster guards the path.",
    worldSeed: Math.floor(Math.random() * 999999),
    narrativeHistory: [],
    sceneRegistry: {}, roomRegistry: {}, storyAct: 0, currentImage: "",
    locationHistory: ["The Iron Gate"],
    inventoryChangeLog: [],
    isCombatActive: false,
    lastRolls: { playerAttack: 0, playerDamage: 0, monsterAttack: 0, monsterDamage: 0 },
  };

  const { url, registry } = await resolveSceneImage(initialState);
  initialState.currentImage = url;
  initialState.sceneRegistry = registry;

  await db.insert(savedGames)
    .values({ userId, gameState: initialState as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({ target: savedGames.userId, set: { gameState: initialState as unknown as Record<string, unknown>, updatedAt: new Date() } });

  return initialState;
}

// --- EXPORT 2: PROCESS TURN ---
export async function processTurn(currentState: GameState, userAction: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

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

  const playerHpDelta = newState.hp - currentState.hp;
  const tookDamageThisTurn = playerHpDelta < 0;

  const actData = STORY_ACTS[Math.min(newState.storyAct, 2)] || STORY_ACTS[0];
  const locationDescription = newState.roomRegistry[newState.location] || roomDesc || "An undefined space.";
  const rulesSnippet = buildRulesReferenceSnippet();
  const aliveThreats = newState.nearbyEntities.filter(e => e.status === 'alive').map(e => `${e.name} HP:${e.hp}/${e.maxHp}`).join(', ') || "None";

  // Sanitize action for narrator prompt (same sanitization as game logic)
  const safeAction = userAction.replace(/[|"\\]/g, '').slice(0, 200).trim();

  const { text: narration } = await generateText({
    model: groq(MODEL_NARRATOR),
    temperature: 0,
    system: `
You are THE NARRATOR for a dark, minimalist dungeon-crawl called "Dungeon Portal".
Never change game state; only describe what the Accountant resolved.
Use: EVENT_SUMMARY, LOCATION name/description, ENTITY STATUS, RULES_REFERENCE. If not listed, treat as unknown.
INVENTORY: ${newState.inventory.map(i => `${i.name} x${i.quantity}`).join(', ') || "Empty"} (only reference items on this list; do NOT mention items/proficiencies not present).
HARD BANS: Do NOT invent NPCs, rooms, shops, taverns/inns, exits/doors, items/spells/mechanics, or any numbers (HP, damage, distances, gold, DCs, rolls).
World: "The Iron Gate" is an exterior gate in cold stone, not an inn/tavern/bar.
Respect MODE but stay concise: ROOM_INTRO/INSPECTION/COMBAT/GENERAL = same brevity.
Style: gritty, grounded dark fantasy; 1–2 sentences under 40 words; no questions; only mention items from INVENTORY.
ACT: ${actData.name} — ${actData.goal}
`,
    prompt: `ACTION: "${safeAction}" | EVENT_SUMMARY: "${newState.lastActionSummary}" | LOCATION: "${newState.location}" DESC: "${locationDescription}" | ENTITY STATUS: "${visibleEntities}" | ALIVE THREATS: "${aliveThreats}" | COMBAT_ACTIVE: ${newState.isCombatActive} | TOOK_DAMAGE_THIS_TURN: ${tookDamageThisTurn} | MODE: ${narrativeMode} | RULES: ${rulesSnippet}`,
  });

  newState.narrativeHistory = [...newState.narrativeHistory, narration].slice(-3);

  // Single save at the end with fully-resolved state (including narrative)
  await db.insert(savedGames)
    .values({ userId, gameState: newState as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({ target: savedGames.userId, set: { gameState: newState as unknown as Record<string, unknown>, updatedAt: new Date() } });

  return { newState, narrativeStream: narration };
}

// --- EXPORT 3: RESET ---
export async function resetGame(archetypeKey?: keyof typeof ARCHETYPES) {
  return createNewGame({ forceNew: true, archetypeKey });
}
