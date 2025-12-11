import { z } from 'zod';

// 1. ITEMS
export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['weapon', 'armor', 'potion', 'scroll', 'misc', 'food', 'material', 'key']),
  quantity: z.coerce.number().int(),
});

// 2. QUESTS
export const questSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  description: z.string(),
});

// 3. ENTITIES
export const entitySchema = z.object({
  name: z.string(),
  status: z.string().default('alive'), 
  description: z.string().optional(),
  hp: z.coerce.number().int().default(10),
  maxHp: z.coerce.number().int().default(10),
  ac: z.coerce.number().int().default(10),
  // New: Attack stats for the monster
  attackBonus: z.coerce.number().int().default(2), 
  damageDice: z.string().default("1d4"),
});

export const narrationModeEnum = z.enum([
  'GENERAL_INTERACTION',
  'ROOM_INTRO',
  'INSPECTION',
  'COMBAT_FOCUS',
  'SEARCH',
  'INVESTIGATE',
  'LOOT',
  'SHEET',
]);
export const logEntrySchema = z.object({
  id: z.string().default(() => `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
  mode: narrationModeEnum,
  summary: z.string(),
  flavor: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});

// 4. MASTER STATE
export const gameStateSchema = z.object({
  hp: z.coerce.number().int(),
  maxHp: z.coerce.number().int(),
  ac: z.coerce.number().int(), // Base AC
  tempAcBonus: z.coerce.number().int().default(0), // For Defensive Stance
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
  worldSeed: z.coerce.number().int().default(0),
  narrativeHistory: z.array(z.string()).default([]),
  sceneRegistry: z.record(z.string()).default({}), 
  roomRegistry: z.record(z.string()).default({}), 
  storyAct: z.coerce.number().int().default(0),
  currentImage: z.string().optional(),
  locationHistory: z.array(z.string()).default([]),
  inventoryChangeLog: z.array(z.string()).default([]),
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
  
  // NEW: COMBAT TRACKING
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

export type GameState = z.infer<typeof gameStateSchema>;
export type LogEntry = z.infer<typeof logEntrySchema>;
export type NarrationMode = z.infer<typeof narrationModeEnum>;
