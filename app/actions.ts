'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '../utils/supabase/server';
import { MONSTER_MANUAL, WEAPON_TABLE, STORY_ACTS } from '../lib/rules';
import { ARCHETYPES } from './characters';
import { getClassReference } from '../lib/5e/classes';
import { armorByName, starterCharacters, weaponsByName, wizardSpellsByName } from '../lib/5e/reference';
import { parseActionIntentWithKnown, ParsedIntent } from '../lib/5e/intents';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

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
  const easyMobs = ["Giant Rat", "Skeleton", "Green Slime"];
  const actMobs = act === 0 ? easyMobs : Object.keys(MONSTER_MANUAL);
  const mobName = actMobs[Math.floor(Math.random() * actMobs.length)];
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
const narrationModeEnum = z.enum([
  "GENERAL_INTERACTION",
  "ROOM_INTRO",
  "INSPECTION",
  "COMBAT_FOCUS",
  "SEARCH",
  "INVESTIGATE",
  "LOOT",
  "SHEET",
]);
const logEntrySchema = z.object({
  id: z.string().default(() => `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
  mode: narrationModeEnum,
  summary: z.string(),
  flavor: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
const gameStateSchema = z.object({
  hp: z.coerce.number().int(),
  maxHp: z.coerce.number().int(),
  ac: z.coerce.number().int(),
  tempAcBonus: z.coerce.number().int().default(0),
  gold: z.coerce.number().int(),
  level: z.coerce.number().int().default(1),
  xp: z.coerce.number().int().default(0),
  xpToNext: z.coerce.number().int().default(300),
  character: z.object({
    name: z.string().default('Adventurer'),
    class: z.string().default('Fighter'),
    background: z.string().default('Wanderer'),
    acBonus: z.coerce.number().int().default(0),
    hpBonus: z.coerce.number().int().default(0),
    startingWeapon: z.string().default('Rusty Dagger'),
    startingArmor: z.string().optional(),
  }).default({
    name: 'Adventurer',
    class: 'Fighter',
    background: 'Wanderer',
    acBonus: 0,
    hpBonus: 0,
    startingWeapon: 'Rusty Dagger',
    startingArmor: undefined,
  }),
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
  locationHistory: z.array(z.string()).default([]),
  inventoryChangeLog: z.array(z.string()).default([]),
  isCombatActive: z.boolean().default(false),
  skills: z.array(z.string()).default([]),
  knownSpells: z.array(z.string()).default([]),
  preparedSpells: z.array(z.string()).default([]),
  spellSlots: z.record(z.object({ max: z.number(), current: z.number() })).default({}),
  spellcastingAbility: z.string().default('int'),
  spellAttackBonus: z.number().default(0),
  spellSaveDc: z.number().default(0),
  activeEffects: z.array(z.object({
    name: z.string(),
    type: z.enum(['ac_bonus', 'buff', 'debuff']).default('buff'),
    value: z.number().optional(),
    expiresAtTurn: z.number().optional(),
  })).default([]),
  log: z.array(logEntrySchema).default([]),
});

type NarrationMode = z.infer<typeof narrationModeEnum>;
export type LogEntry = z.infer<typeof logEntrySchema>;
type GameState = z.infer<typeof gameStateSchema>;
type ActionIntent = 'attack' | 'defend' | 'run' | 'other';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000];

function buildInventoryFromEquipment(equipment: string[]): Array<z.infer<typeof itemSchema>> {
  return equipment.map((name, idx) => {
    const lower = name.toLowerCase();
    const isWeapon = !!weaponsByName[lower];
    const isArmor = !!armorByName[lower];
    const type: 'weapon' | 'armor' | 'misc' = isWeapon ? 'weapon' : isArmor ? 'armor' : 'misc';
    return {
      id: `eq-${idx}-${Date.now().toString(36)}`,
      name,
      type,
      quantity: 1,
    };
  });
}

async function hydrateState(rawState: unknown): Promise<GameState> {
  const parsed = gameStateSchema.safeParse(rawState);
  if (!parsed.success) {
    throw new Error("Saved game is incompatible with the current version.");
  }
  const state = parsed.data;

  // Backfill: ensure skills array exists based on class if missing/empty
  if (!state.skills || state.skills.length === 0) {
    const classKey = (state.character?.class || 'fighter').toLowerCase();
    state.skills = getClassReference(classKey).skills;
  }

  // Backfill: ensure spell fields exist
  state.knownSpells = state.knownSpells || [];
  state.preparedSpells = state.preparedSpells || [];
  state.spellSlots = state.spellSlots || {};
  state.spellcastingAbility = state.spellcastingAbility || 'int';
  state.spellAttackBonus = state.spellAttackBonus || 0;
  state.spellSaveDc = state.spellSaveDc || 0;
  state.activeEffects = state.activeEffects || [];

  // Backfill: migrate old narrativeHistory into log as summary-only entries
  if ((!state.log || state.log.length === 0) && state.narrativeHistory && state.narrativeHistory.length > 0) {
    const migrated = state.narrativeHistory.map((entry, idx) => ({
      id: `log-migrated-${idx}-${Date.now().toString(36)}`,
      mode: "GENERAL_INTERACTION" as const,
      summary: entry,
      flavor: undefined,
      createdAt: new Date().toISOString(),
    }));
    state.log = migrated.slice(-10);
  } else {
    state.log = state.log || [];
  }

  // Rebuild derived assets when missing
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
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (err) {
    console.error("Failed to ensure cache dir", err);
  }
  return cacheDir;
}

async function cacheSceneImage(remoteUrl: string, fileName: string): Promise<string | null> {
  try {
    const cacheDir = await ensureCacheDir();
    const filePath = path.join(cacheDir, fileName);
    // If already cached, just return
    try {
      await fs.access(filePath);
      return `/scene-cache/${fileName}`;
    } catch {
      // proceed to fetch
    }
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return `/scene-cache/${fileName}`;
  } catch (err) {
    console.error("Image cache fetch failed, using remote URL", err);
    return null;
  }
}

async function resolveSceneImage(state: GameState): Promise<{ url: string; registry: Record<string, string> }> {
  const VARIANT_POOL = 3;
  const activeThreat = state.nearbyEntities.find(e => e.status !== 'dead' && e.status !== 'object');
  const sceneKey = activeThreat ? `${state.location}|${activeThreat.name}` : state.location;
  if (state.sceneRegistry && state.sceneRegistry[sceneKey]) {
    return { url: state.sceneRegistry[sceneKey], registry: state.sceneRegistry };
  }
  let visualPrompt = state.location;
  if (activeThreat) visualPrompt = `A terrifying ${activeThreat.name} inside ${state.location}`;
  const subjectHash = visualPrompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variantIndex = Math.abs((state.worldSeed || 0) % VARIANT_POOL);
  const stableSeed = subjectHash + variantIndex * 9973; // variant-specific but stable across runs
  const encodedPrompt = encodeURIComponent(visualPrompt + " fantasy oil painting style dark gritty 8k");
  const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=300&nologo=true&seed=${stableSeed}`;
  const fileName = `${sceneKey.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${variantIndex}.jpg`;
  const cachedPath = await cacheSceneImage(remoteUrl, fileName);
  const finalUrl = cachedPath || remoteUrl;
  return { url: finalUrl, registry: { ...state.sceneRegistry, [sceneKey]: finalUrl } };
}

async function resolveRoomDescription(state: GameState): Promise<{ desc: string, registry: Record<string, string> }> {
  if (state.roomRegistry && state.roomRegistry[state.location]) {
    return { desc: state.roomRegistry[state.location], registry: state.roomRegistry };
  }
  const aliveThreats = state.nearbyEntities.filter(e => e.status === 'alive').map(e => e.name);
  const desc = aliveThreats.length > 0
    ? `${state.location} with ${aliveThreats.join(', ')} nearby.`
    : `${state.location} is quiet.`;
  const newRegistry = { ...state.roomRegistry, [state.location]: desc };
  return { desc, registry: newRegistry };
}

type NarrationMode = "GENERAL_INTERACTION" | "ROOM_INTRO" | "INSPECTION" | "COMBAT_FOCUS" | "SEARCH" | "INVESTIGATE" | "LOOT" | "SHEET";

function shouldUseNarrator(mode: NarrationMode): boolean {
  switch (mode) {
    case "SEARCH":
    case "INVESTIGATE":
    case "LOOT":
    case "ROOM_INTRO":
    case "GENERAL_INTERACTION":
    case "COMBAT_FOCUS":
      return true;
    case "SHEET":
    case "INSPECTION":
    default:
      return false;
  }
}

function summarizeInventory(inventory: GameState["inventory"]): { summary: string; items: string[] } {
  if (!inventory || inventory.length === 0) {
    return { summary: "Unarmed; nothing notable carried.", items: [] };
  }

  const primaryWeapon = inventory.find(i => i.type === 'weapon')?.name;
  const armor = inventory.find(i => i.type === 'armor')?.name;
  const extras = inventory
    .filter(i => i.type !== 'weapon' && i.type !== 'armor')
    .slice(0, 1)
    .map(i => i.name);

  const names = [primaryWeapon, armor, ...extras].filter(Boolean) as string[];
  const summary = names.length > 0 ? names.join(' and ') : "Basic gear only.";
  return { summary, items: names };
}

function buildAccountantFacts(params: {
  newState: GameState;
  previousState: GameState;
  roomDesc: string;
  engineFacts: string[];
}) {
  const { newState, previousState, roomDesc, engineFacts } = params;
  const facts: string[] = [];

  const trimmedFacts = engineFacts.map(f => f.trim()).filter(Boolean);
  facts.push(...trimmedFacts);

  facts.push(`Location: ${newState.location}. ${roomDesc}`);

  const hpDelta = newState.hp - previousState.hp;
  const hpDeltaNote = hpDelta === 0 ? "" : hpDelta > 0 ? ` (healed ${hpDelta})` : ` (lost ${Math.abs(hpDelta)})`;
  facts.push(`You are at ${newState.hp}/${newState.maxHp} HP${hpDeltaNote}, AC ${newState.ac}.`);

  const threats = newState.nearbyEntities.map(e =>
    `${e.name} ${e.status}${e.status !== 'dead' ? ` (${e.hp}/${e.maxHp} HP)` : ''}`
  ).join('; ');
  if (threats) facts.push(`Nearby: ${threats}.`);

  const { summary: inventorySummary, items: allowedItems } = summarizeInventory(newState.inventory);

  return {
    facts,
    eventSummary: facts.join(' '),
    inventorySummary,
    allowedItems,
  };
}

function isFlavorSafe(flavor: string): boolean {
  const trimmed = flavor.trim();
  if (!trimmed) return false;
  if (trimmed.length > 240) return false;
  if (/\d/.test(trimmed)) return false; // no new numbers from the Narrator
  const lower = trimmed.toLowerCase();
  const banned = ['hp', 'hit points', 'ac', 'armor class', 'xp', 'experience', 'damage', 'roll', 'dc', 'gold', 'coin', 'gp'];
  if (banned.some(token => lower.includes(token))) return false;
  const sentenceCount = trimmed.split(/[.!?]/).filter(Boolean).length;
  if (sentenceCount > 1) return false;
  return true;
}

async function generateFlavorLine(args: {
  eventSummary: string;
  locationDescription: string;
  inventorySummary: string;
  mode: NarrationMode;
}): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: groq(MODEL_NARRATOR),
      temperature: 0.5,
      maxTokens: 80,
      system: `
You are THE NARRATOR for a dark, minimalist dungeon-crawl called "Dungeon Portal".
You only add mood beneath a factual log. You never change game state.

ROLE:
- INPUT: MODE + EVENT_SUMMARY + LOCATION_DESCRIPTION (+ optional INVENTORY_SUMMARY)
- OUTPUT: ONE sentence (~30 words) of atmosphere; do NOT repeat the facts.

HARD RULES:
- No new items, gold, weapons, armor, loot, NPCs, shops, exits, abilities, spells, skills.
- No numbers (HP, damage, AC, DC, gold, distances, dice).
- For SEARCH/LOOT: describe smell, dust, blood, weight/texture; never add extra loot.
- For INVESTIGATE: hint mood/age/wear of existing objects; no secret doors or puzzles.
- For COMBAT_FOCUS: describe danger and motion, not mechanics.
- For ROOM_INTRO/GENERAL: lean on environment and tone.
- "The Iron Gate" is an exterior iron gate in cold stone; never a tavern/inn/bar.

STYLE:
- Gritty, grounded dark fantasy; one or two sharp details.
- One sentence max; no questions.
`,
    prompt: `
MODE: ${args.mode}
EVENT_SUMMARY: ${args.eventSummary}
LOCATION_DESCRIPTION: ${args.locationDescription}
INVENTORY_SUMMARY: ${args.inventorySummary}
`,
    });
    const flavor = text.trim();
    if (!flavor) return null;
    if (!isFlavorSafe(flavor)) return null;
    return flavor;
  } catch (err) {
    console.error("Narrator generation failed:", err);
    return null;
  }
}

function getWeaponDamageDice(name: string | undefined): string {
  if (!name) return "1d4";
  const weapon = weaponsByName[name.toLowerCase()];
  if (weapon?.damage) {
    const diceMatch = weapon.damage.match(/\d+d\d+/i);
    if (diceMatch) return diceMatch[0];
    const flatMatch = weapon.damage.match(/\d+/);
    if (flatMatch) return flatMatch[0];
  }
  return WEAPON_TABLE[name] || "1d4";
}

function isWeaponAllowedForClass(weaponName: string | undefined, classKey: string): boolean {
  if (!weaponName) return false;
  const ref = getClassReference(classKey);
  return ref.allowedWeapons.map(w => w.toLowerCase()).includes(weaponName.toLowerCase());
}

// --- MAIN LOGIC ENGINE ---
// DM principles: describe what the player perceives, let the player act, resolve fairly.
async function _updateGameState(currentState: GameState, userAction: string) {
  // 1. DETERMINE PLAYER WEAPON & DAMAGE
  const parsedIntent: ParsedIntent = parseActionIntentWithKnown(
    userAction,
    currentState.knownSpells || [],
    Object.keys(wizardSpellsByName)
  );
  const actionIntent: ActionIntent =
    parsedIntent.type === 'attack'
      ? 'attack'
      : parsedIntent.type === 'defend'
      ? 'defend'
      : parsedIntent.type === 'run'
      ? 'run'
      : 'other';

  const classKey = (currentState.character?.class || 'fighter').toLowerCase();
  const preferredWeaponName = parsedIntent.type === 'attack' && parsedIntent.weaponName
    ? parsedIntent.weaponName
    : currentState.inventory.find(i => i.type === 'weapon')?.name;

  let weaponName = preferredWeaponName || "Fists";
  let playerDmgDice = getWeaponDamageDice(weaponName);
  const weaponAllowed = isWeaponAllowedForClass(weaponName, classKey);
  if (!weaponAllowed && weaponName !== "Fists") {
    playerDmgDice = "1d4";
    weaponName = "Fists";
  }

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
    log: [...(currentState.log || [])],
  };

  // 3. ACTIVE MONSTER CONTEXT
  const activeMonsterIndex = newState.nearbyEntities.findIndex(e => e.status === 'alive');
  const activeMonster = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;

  // 4. PLAYER TURN
  let playerAttackRoll = 0;
  let playerDamageRoll = 0;
  const summaryParts: string[] = [];

  const monsterWasAlive = activeMonster?.status === 'alive';

  if (parsedIntent.type === 'castAbility') {
    const spellKey = parsedIntent.abilityName.toLowerCase();
    const spell = wizardSpellsByName[spellKey];
    const isKnown = (newState.knownSpells || []).some(s => s.toLowerCase() === spellKey);
    const isPrepared = (newState.preparedSpells || []).some(s => s.toLowerCase() === spellKey);

    if (!spell || !isKnown) {
      summaryParts.push(`You have not learned that spell.`);
    } else if (!isPrepared && !spell.level.toLowerCase().includes('cantrip')) {
      summaryParts.push(`You have not prepared ${spell.name}.`);
    } else {
      const isCantrip = spell.level.toLowerCase().includes('cantrip');
      const slotKey = 'level_1';
      const slots = newState.spellSlots || {};
      if (!isCantrip) {
        const slot = slots[slotKey];
        if (!slot || slot.current <= 0) {
          summaryParts.push(`You have no ${slotKey.replace('_', ' ')} spell slots left.`);
        } else {
          slots[slotKey] = { ...slot, current: slot.current - 1 };
          newState.spellSlots = slots;
        }
      }

      // Resolve a minimal set of spells
      const targetName = parsedIntent.target || activeMonster?.name || 'the area';
      if (spell.name.toLowerCase() === 'magic missile') {
        const dmg = rollDice("1d4+1");
        if (activeMonster) {
          const updatedHp = Math.max(0, activeMonster.hp - dmg);
          newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
            idx === activeMonsterIndex
              ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
              : entity
          );
        }
        summaryParts.push(`You cast Magic Missile at ${targetName}, dealing ${dmg} force damage.`);
      } else if (spell.name.toLowerCase() === 'thunderwave') {
        const dmg = rollDice("2d8");
        if (activeMonster) {
          const updatedHp = Math.max(0, activeMonster.hp - dmg);
          newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
            idx === activeMonsterIndex
              ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
              : entity
          );
        }
        summaryParts.push(`You unleash Thunderwave at ${targetName}, dealing ${dmg} thunder damage.`);
      } else if (spell.name.toLowerCase() === 'fire bolt') {
        const dmg = rollDice("1d10");
        if (activeMonster) {
          const updatedHp = Math.max(0, activeMonster.hp - dmg);
          newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
            idx === activeMonsterIndex
              ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
              : entity
          );
        }
        summaryParts.push(`You hurl a Fire Bolt at ${targetName}, dealing ${dmg} fire damage.`);
      } else if (spell.name.toLowerCase() === 'ray of frost') {
        const dmg = rollDice("1d8");
        if (activeMonster) {
          const updatedHp = Math.max(0, activeMonster.hp - dmg);
          newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
            idx === activeMonsterIndex
              ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
              : entity
          );
        }
        summaryParts.push(`You cast Ray of Frost at ${targetName}, dealing ${dmg} cold damage.`);
      } else if (spell.name.toLowerCase() === 'shield') {
        newState.tempAcBonus = Math.max(newState.tempAcBonus, 5);
        newState.activeEffects = [...(newState.activeEffects || []), { name: 'Shield', type: 'ac_bonus', value: 5, expiresAtTurn: newState.level + 1 }];
        summaryParts.push(`You raise Shield, gaining +5 AC until the start of your next turn.`);
      } else if (spell.name.toLowerCase() === 'mage armor') {
        const dexBonus = Math.floor(((newState.character?.acBonus || 0) + (newState.spellcastingAbility === 'int' ? 0 : 0)));
        newState.ac = Math.max(newState.ac, 13 + dexBonus);
        newState.activeEffects = [...(newState.activeEffects || []), { name: 'Mage Armor', type: 'ac_bonus', value: 13 + dexBonus, expiresAtTurn: undefined }];
        summaryParts.push(`You ward yourself with Mage Armor, hardening your defenses.`);
      } else if (spell.name.toLowerCase() === 'detect magic') {
        summaryParts.push(`You attune your senses; lingering magic hums in the air.`);
      } else if (spell.name.toLowerCase() === 'identify') {
        summaryParts.push(`You focus to identify an item or effect; details surface in your mind.`);
      } else {
        summaryParts.push(`You cast ${spell.name}, but its effect is not modeled yet.`);
      }
    }
  } else if (parsedIntent.type === 'look') {
    const threats = newState.nearbyEntities.filter(e => e.status === 'alive');
    const threatText = threats.length > 0
      ? `You spot ${threats.map(e => `${e.name} (${e.hp}/${e.maxHp} HP)`).join(', ')}.`
      : "No immediate threats.";
    summaryParts.push(`You look around ${newState.location}. ${threatText}`);
  } else if (actionIntent === 'attack' && activeMonster) {
    playerAttackRoll = Math.floor(Math.random() * 20) + 1; // no bonus for now
    if (playerAttackRoll >= activeMonster.ac) {
      playerDamageRoll = rollDice(playerDmgDice);
      const updatedHp = Math.max(0, activeMonster.hp - playerDamageRoll);
      newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
        idx === activeMonsterIndex
          ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
          : entity
      );
      summaryParts.push(`You hit ${activeMonster.name} with ${weaponName} for ${playerDamageRoll} damage (roll ${playerAttackRoll} vs AC ${activeMonster.ac}).`);
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
  } else if (parsedIntent.type === 'checkSheet') {
    const skills = newState.skills?.length ? newState.skills.join(', ') : 'None';
    const primaryWeapon = newState.inventory.find(i => i.type === 'weapon')?.name || 'None';
    const armor = newState.inventory.find(i => i.type === 'armor')?.name || 'None';
    const known = newState.knownSpells?.length ? newState.knownSpells.join(', ') : 'None';
    const prepared = newState.preparedSpells?.length ? newState.preparedSpells.join(', ') : 'None';
    const slotText = Object.entries(newState.spellSlots || {})
      .map(([lvl, data]) => `${lvl.replace('_', ' ')}: ${data.current}/${data.max}`)
      .join('; ');
    summaryParts.push(`Skills: ${skills}. Equipped weapon: ${primaryWeapon}. Armor: ${armor}. Spells known: ${known}. Spells prepared: ${prepared}. Slots: ${slotText || 'None'}.`);
  } else if (actionIntent === 'other' && newState.nearbyEntities.length === 0) {
    summaryParts.push("You act, but there is no immediate threat here.");
  } else if (actionIntent === 'attack' && !activeMonster) {
    summaryParts.push("You swing, but no foe stands before you.");
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
  } else if (!monsterStillAlive && actionIntent === 'attack') {
    summaryParts.push("There is nothing left to attack.");
  }

  // 6. CLEANUP COMBAT FLAGS
  newState.tempAcBonus = 0;
  const anyAlive = newState.nearbyEntities.some(e => e.status === 'alive');
  newState.isCombatActive = (anyAlive && (newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend')) && newState.hp > 0;
  newState.nearbyEntities = [...newState.nearbyEntities];

  // 6a. LOOTING / KEY RECOVERY (simple heuristic for the Iron Key at the gate)
  const wantsKey = /(key|glint|shiny|metal|object|take|grab|pick|retrieve)/i.test(userAction) && newState.location.toLowerCase().includes('gate');
  const hasIronKey = newState.inventory.some(i => i.name === 'Iron Key');
  if (wantsKey && !hasIronKey) {
    newState.inventory = [
      ...newState.inventory,
      { id: `key-${Date.now().toString(36)}`, name: 'Iron Key', type: 'key', quantity: 1 }
    ];
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Gained Iron Key at ${newState.location}`].slice(-10);
    summaryParts.push("You recover the Iron Key from the debris.");
    // Once the key is taken, nearby rats lose interest
    newState.nearbyEntities = newState.nearbyEntities.map(ent =>
      ent.name.toLowerCase().includes('rat')
        ? { ...ent, status: ent.status === 'alive' ? 'fleeing' : ent.status }
        : ent
    );
    newState.isCombatActive = newState.nearbyEntities.some(e => e.status === 'alive' && e.hp > 0) && newState.hp > 0;
  }

  // 6b. TRACK LOCATION HISTORY
  if (newState.location !== currentState.location) {
    const history = newState.locationHistory || [];
    const updatedHistory = [...history, newState.location].slice(-10);
    newState.locationHistory = updatedHistory;
  }

  // 7. STORY ACT BOUNDS
  const maxAct = Math.max(...Object.keys(STORY_ACTS).map(Number));
  newState.storyAct = Math.min(maxAct, Math.max(0, newState.storyAct));

  // 8. XP & LEVEL
  const monsterNow = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;
  const monsterKilled = monsterWasAlive && monsterNow && monsterNow.status === 'dead';
  if (monsterKilled) {
    const xpAward = MONSTER_MANUAL[activeMonster!.name]?.hp ? Math.max(25, MONSTER_MANUAL[activeMonster!.name].hp * 5) : 50;
    newState.xp += xpAward;
    summaryParts.push(`You gain ${xpAward} XP.`);
    let leveled = false;
    while (newState.level < XP_THRESHOLDS.length && newState.xp >= XP_THRESHOLDS[newState.level]) {
      newState.level += 1;
      newState.xpToNext = XP_THRESHOLDS[newState.level] ?? newState.xpToNext;
      // Simple HP bump per level
      newState.maxHp += 2;
      newState.hp = Math.max(newState.hp, newState.maxHp);
      leveled = true;
    }
    if (leveled) summaryParts.push(`You reach level ${newState.level}.`);
  }

  // 8b. LOOT CORPSES (simple generic loot)
  const wantsLoot = /(loot|rummage|pick over|salvage)/i.test(userAction);
  const deadCorpse = newState.nearbyEntities.find(e => e.status === 'dead' && !e.name.toLowerCase().includes('looted'));
  if (wantsLoot && deadCorpse) {
    const goldFind = Math.max(1, Math.floor(Math.random() * 6));
    newState.gold += goldFind;
    const trophyName = `${deadCorpse.name} Remnant`;
    newState.inventory = [...newState.inventory, { id: `loot-${Date.now().toString(36)}`, name: trophyName, type: 'misc', quantity: 1 }];
    // Mark corpse as looted
    newState.nearbyEntities = newState.nearbyEntities.map(e =>
      e === deadCorpse ? { ...e, name: `${e.name} (looted)` } : e
    );
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Looted ${deadCorpse.name}: +${goldFind} gold, +${trophyName}`].slice(-10);
    summaryParts.push(`You loot the ${deadCorpse.name}, gaining ${goldFind} gold and a ${trophyName}.`);
  }

  // 9. SUMMARY & ROLLS
  newState.lastActionSummary = summaryParts.join(' ').trim() || "Nothing of note happens.";
  newState.lastRolls = {
    playerAttack: playerAttackRoll,
    playerDamage: playerDamageRoll,
    monsterAttack: monsterAttackRoll,
    monsterDamage: monsterDamageRoll,
  };

  // 9. UPDATE ROOM + IMAGE REGISTRIES
  const { desc: finalDesc, registry: textReg } = await resolveRoomDescription(newState);
  newState.roomRegistry = textReg;

  const { url, registry: imgReg } = await resolveSceneImage(newState);
  newState.currentImage = url;
  newState.sceneRegistry = imgReg;

  const isNewLocation = newState.location !== currentState.location;
  const isLooking = userAction.toLowerCase().includes('look') || userAction.toLowerCase().includes('search');
  const isCombat = newState.isCombatActive;
  const wantsInvestigate = /(investigate|inspect|examine)/i.test(userAction);
  const isSheet = parsedIntent.type === 'checkSheet';
  
  let narrationMode: NarrationMode = "GENERAL_INTERACTION";
  if (isNewLocation) narrationMode = "ROOM_INTRO";
  else if (isSheet) narrationMode = "SHEET";
  else if (wantsLoot) narrationMode = "LOOT";
  else if (wantsInvestigate) narrationMode = "INVESTIGATE";
  else if (isLooking) narrationMode = "SEARCH";
  else if (isCombat) narrationMode = "COMBAT_FOCUS";

  return { newState, roomDesc: finalDesc, accountantFacts: [...summaryParts], eventSummary: newState.lastActionSummary, narrationMode };
}

// --- EXPORT 1: CREATE NEW GAME ---
type CreateOptions = { archetypeKey?: keyof typeof ARCHETYPES; forceNew?: boolean };

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const archetypeKey = opts?.archetypeKey;
  const forceNew = opts?.forceNew ?? false;

  const { data: existingSave } = await supabase.from('saved_games').select('game_state').eq('user_id', user.id).single();
  if (existingSave?.game_state && !forceNew) {
    const hydrated = await hydrateState(existingSave.game_state);
    const { error: updateError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: hydrated }, { onConflict: 'user_id' });
    if (updateError) console.error("Failed to update existing save:", updateError);
    return hydrated;
  }

  const start = getRandomScenario(0);
  const archetype = archetypeKey && ARCHETYPES[archetypeKey] ? ARCHETYPES[archetypeKey] : ARCHETYPES.fighter;
  const classRef = getClassReference(archetypeKey || 'fighter');

  const startingWeapon = archetype.startingWeapon || 'Rusty Dagger';
  const startingArmor = archetype.startingArmor;
  const baseAc = 10 + (archetype.acBonus || 0);
  const baseHp = 20 + (archetype.hpBonus || 0);
  const isWizard = (archetypeKey || 'fighter') === 'wizard';

  let initialHp = baseHp;
  let initialAc = baseAc;
  let skills = classRef.skills;
  let inventory: GameState["inventory"] = [
    { id: '1', name: startingWeapon, type: 'weapon', quantity: 1 },
    ...(startingArmor ? [{ id: 'armor-1', name: startingArmor, type: 'armor', quantity: 1 }] : []),
  ];
  let knownSpells: string[] = [];
  let preparedSpells: string[] = [];
  let spellSlots: Record<string, { max: number; current: number }> = {};
  let spellcastingAbility = 'int';
  let spellAttackBonus = 0;
  let spellSaveDc = 0;

  if (isWizard) {
    const starter = starterCharacters.find(c => c.class.toLowerCase() === 'wizard') || starterCharacters[0];
    if (starter) {
      initialHp = starter.max_hp;
      initialAc = 10 + Math.floor(((starter.abilities.dex || 10) - 10) / 2);
      skills = starter.skills;
      inventory = buildInventoryFromEquipment(starter.equipment);
      knownSpells = [...starter.spells.cantrips_known, ...starter.spells.spellbook];
      preparedSpells = starter.spells.prepared;
      spellSlots = Object.fromEntries(
        Object.entries(starter.casting.slots).map(([lvl, data]) => [lvl, { max: data.max, current: data.current }])
      );
      spellcastingAbility = starter.casting.spellcasting_ability || 'int';
      spellAttackBonus = starter.casting.spell_attack_bonus || 0;
      spellSaveDc = starter.casting.spell_save_dc || 0;
    }
  }

  const initialState: GameState = {
    hp: initialHp, maxHp: initialHp, ac: initialAc, tempAcBonus: 0, gold: 0,
    level: 1, xp: 0, xpToNext: XP_THRESHOLDS[1],
    character: {
      name: 'Adventurer',
      class: archetype.label,
      background: archetype.background,
      acBonus: archetype.acBonus,
      hpBonus: archetype.hpBonus,
      startingWeapon,
      startingArmor: startingArmor || undefined,
    },
    location: "The Iron Gate", 
    inventory,
    skills,
    knownSpells,
    preparedSpells,
    spellSlots,
    spellcastingAbility,
    spellAttackBonus,
    spellSaveDc,
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
    log: [],
    sceneRegistry: {}, roomRegistry: {}, storyAct: 0, currentImage: "",
    locationHistory: ["The Iron Gate"],
    inventoryChangeLog: [],
    isCombatActive: false // Start neutral; combat begins on hostile actions
  };

  const { url, registry } = await resolveSceneImage(initialState);
  initialState.currentImage = url;
  initialState.sceneRegistry = registry;

  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: initialState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save new game: ${saveError.message}`);
  return initialState;
}

// --- EXPORT 2: PROCESS TURN ---
export async function processTurn(currentState: GameState, userAction: string): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { newState, roomDesc, accountantFacts: engineFacts, eventSummary, narrationMode } = await _updateGameState(currentState, userAction);

  const locationDescription = newState.roomRegistry[newState.location] || roomDesc || "An undefined space.";
  const { facts, eventSummary: accountantSummary, inventorySummary } = buildAccountantFacts({
    newState,
    previousState: currentState,
    roomDesc: locationDescription,
    engineFacts,
  });

  let factBlock = facts.join('\n');
  let skipFlavor = false;

  if (["SEARCH", "ROOM_INTRO", "INVESTIGATE"].includes(narrationMode)) {
    const lastSummary = newState.log?.slice(-1)[0]?.summary;
    if (lastSummary && lastSummary === factBlock) {
      factBlock = "You scan the area again; nothing seems to have changed.";
      skipFlavor = true;
    }
  }

  const flavorLine = shouldUseNarrator(narrationMode) && !skipFlavor
    ? await generateFlavorLine({
        eventSummary: accountantSummary,
        locationDescription,
        inventorySummary,
        mode: narrationMode,
      })
    : null;

  const combinedNarrative = flavorLine ? `${factBlock}\n\n${flavorLine}` : factBlock;

  const logEntry: LogEntry = {
    summary: factBlock || eventSummary,
    flavor: flavorLine || undefined,
    mode: narrationMode,
    createdAt: new Date().toISOString(),
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  };

  newState.log = [...(newState.log || []), logEntry].slice(-50);
  newState.narrativeHistory = [...newState.narrativeHistory, combinedNarrative].slice(-3);

  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save turn: ${saveError.message}`);

  return { newState, logEntry };
}

// --- EXPORT 3: RESET ---
export async function resetGame(archetypeKey?: keyof typeof ARCHETYPES) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  return createNewGame({ forceNew: true, archetypeKey });
}
