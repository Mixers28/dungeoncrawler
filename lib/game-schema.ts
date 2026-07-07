import { z } from 'zod';

// Shared Zod schemas that define the shape of game content and runtime state.

// 1. ITEMS
export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['weapon', 'armor', 'potion', 'scroll', 'misc', 'food', 'material', 'key']),
  quantity: z.coerce.number().int(),
  equipped: z.boolean().default(false),
  effect: z.string().optional(),
});

// 2. QUESTS
export const questSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  description: z.string(),
  objectives: z.array(z.object({
    id: z.string(),
    text: z.string(),
    done: z.boolean().default(false),
    flag: z.string().optional(),
  })).default([]),
});

// 3. ENTITIES (monsters/NPCs on the map)
export const entitySchema = z.object({
  name: z.string(),
  status: z.string().default('alive'),
  description: z.string().optional(),
  hp: z.coerce.number().int().default(10),
  maxHp: z.coerce.number().int().default(10),
  ac: z.coerce.number().int().default(10),
  attackBonus: z.coerce.number().int().default(2),
  damageDice: z.string().default('1d4'),
  effects: z.array(z.object({
    name: z.string(),
    type: z.enum(['debuff', 'buff']).default('debuff'),
    expiresAtTurn: z.number().optional(),
  })).default([]),
  imageUrl: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const narrationModeEnum = z.enum([
  'ROOM_INTRO',
  'COMBAT_HIT',
  'COMBAT_MISS',
  'COMBAT_KILL',
  'SEARCH_FOUND',
  'SEARCH_EMPTY',
  'LOOT_GAIN',
  'INVESTIGATE',
  'GENERAL',
  'SHEET',
]);

export const rollEventSchema = z.object({
  label: z.string(),
  d20: z.number().int(),
  modifier: z.number().int(),
  total: z.number().int(),
  against: z.number().int(),
  outcome: z.enum(['hit', 'miss', 'crit']),
  damage: z.number().int().optional(),
  damageDice: z.string().optional(),
  damageType: z.string().optional(),
});
export type RollEvent = z.infer<typeof rollEventSchema>;

export const logEntrySchema = z.object({
  id: z.string().default(() => `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
  mode: narrationModeEnum,
  summary: z.string(),
  flavor: z.string().optional(),
  actorName: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  rolls: z.array(rollEventSchema).optional(),
});

// 4. MASTER STATE (saved/loaded between turns)
export const gameStateSchema = z.object({
  hp: z.coerce.number().int(),
  maxHp: z.coerce.number().int(),
  ac: z.coerce.number().int(),
  tempAcBonus: z.coerce.number().int().default(0),
  gold: z.coerce.number().int().nonnegative().default(0),
  level: z.coerce.number().int().default(1),
  xp: z.coerce.number().int().default(0),
  xpToNext: z.coerce.number().int().default(300),
  character: z.object({
    name: z.string().default('Adventurer'),
    class: z.string().default('Fighter'),
    background: z.string().default('Wanderer'),
    acBonus: z.coerce.number().int().default(0),
    hpBonus: z.coerce.number().int().default(0),
    attackBonus: z.coerce.number().int().default(0),
    startingWeapon: z.string().default('Rusty Dagger'),
    startingArmor: z.string().optional(),
    archetypeKey: z.string().default('fighter'),
  }).default({
    name: 'Adventurer',
    class: 'Fighter',
    background: 'Wanderer',
    acBonus: 0,
    hpBonus: 0,
    attackBonus: 0,
    startingWeapon: 'Rusty Dagger',
    startingArmor: undefined,
    archetypeKey: 'fighter',
  }),
  location: z.string(),
  inventory: z.array(itemSchema).max(100).default([]),
  equippedWeaponId: z.string().optional(),
  equippedArmorId: z.string().optional(),
  quests: z.array(questSchema).default([]),
  nearbyEntities: z.array(entitySchema).default([]),
  lastActionSummary: z.string(),
  worldSeed: z.coerce.number().int().default(0),
  narrativeHistory: z.array(z.string()).default([]),
  sceneRegistry: z.record(z.string()).default({}),
  roomRegistry: z.record(z.string()).default({}),
  monsterRegistry: z.record(z.object({
    imageUrl: z.string().startsWith('/monster-cache/'),
    lastSeenFloor: z.number().int().positive(),
    encounterCount: z.number().int().nonnegative(),
  })).default({}),
  storyAct: z.coerce.number().int().default(0),
  currentFloor: z.coerce.number().int().default(1),
  currentImage: z.string().optional(),
  locationHistory: z.array(z.string()).default([]),
  sceneVisits: z.record(z.coerce.number().int().nonnegative()).default({}),
  inventoryChangeLog: z.array(z.string()).default([]),
  lastRolls: z.object({
    playerAttack: z.coerce.number().int().default(0),
    playerDamage: z.coerce.number().int().default(0),
    monsterAttack: z.coerce.number().int().default(0),
    monsterDamage: z.coerce.number().int().default(0),
    playerAttackIsSave: z.boolean().default(false),
    playerAttackDc: z.coerce.number().int().default(0),
  }).default({
    playerAttack: 0,
    playerDamage: 0,
    monsterAttack: 0,
    monsterDamage: 0,
    playerAttackIsSave: false,
    playerAttackDc: 0,
  }),
  isCombatActive: z.boolean().default(false),
  abilityScores: z.record(z.string(), z.number()).default({}),
  skills: z.array(z.string()).default([]),
  knownSpells: z.array(z.string()).default([]),
  preparedSpells: z.array(z.string()).default([]),
  spellSlots: z.record(z.object({ max: z.number(), current: z.number() })).default({}),
  spellcastingAbility: z.string().default('int'),
  spellAttackBonus: z.number().default(0),
  spellSaveDc: z.number().default(0),
  activeEffects: z.array(z.object({
    name: z.string(),
    type: z.enum(['ac_bonus', 'attack_bonus', 'buff', 'debuff']).default('buff'),
    value: z.number().optional(),
    expiresAtTurn: z.number().optional(),
  })).default([]),
  storySceneId: z.string().default('iron_gate_v1'),
  storyFlags: z.array(z.string()).default([]),
  turnCounter: z.number().default(0),
  totalKills: z.number().int().default(0),
  log: z.array(logEntrySchema).default([]),
});

export const sessionStateSchema = gameStateSchema.pick({
  worldSeed: true,
  storySceneId: true,
  location: true,
  storyFlags: true,
  storyAct: true,
  currentFloor: true,
  sceneVisits: true,
  nearbyEntities: true,
  isCombatActive: true,
  quests: true,
  sceneRegistry: true,
  roomRegistry: true,
  monsterRegistry: true,
  locationHistory: true,
  currentImage: true,
  turnCounter: true,
  log: true,
}).extend({
  turnOrder: z.array(z.string()).default([]),
  currentTurnPlayerId: z.string().nullable().default(null),
  version: z.number().int().nonnegative().default(0),
});

export const characterStateSchema = gameStateSchema.pick({
  hp: true,
  maxHp: true,
  ac: true,
  tempAcBonus: true,
  gold: true,
  level: true,
  xp: true,
  xpToNext: true,
  character: true,
  inventory: true,
  equippedWeaponId: true,
  equippedArmorId: true,
  lastActionSummary: true,
  narrativeHistory: true,
  inventoryChangeLog: true,
  lastRolls: true,
  abilityScores: true,
  skills: true,
  knownSpells: true,
  preparedSpells: true,
  spellSlots: true,
  spellcastingAbility: true,
  spellAttackBonus: true,
  spellSaveDc: true,
  activeEffects: true,
  totalKills: true,
}).extend({
  playerId: z.string().min(1),
  userId: z.string().nullable().default(null),
});

export type Entity = z.infer<typeof entitySchema>;
export type GameState = z.infer<typeof gameStateSchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
export type LogEntry = z.infer<typeof logEntrySchema>;
export type NarrationMode = z.infer<typeof narrationModeEnum>;
