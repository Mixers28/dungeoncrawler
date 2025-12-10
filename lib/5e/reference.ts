import { z } from 'zod';
import abilityScoreData from '../../data/5e/abilities.json';
import armorData from '../../data/5e/armor.json';
import basicActionData from '../../data/5e/basic_actions.json';
import conditionData from '../../data/5e/conditions.json';
import skillData from '../../data/5e/skills.json';
import weaponData from '../../data/5e/weapons.json';
import wizardSpellData from '../../data/5e/spells-wizard.json';

const abilityScoreSchema = z.object({
  name: z.string(),
  abbr: z.string(),
  summary: z.string(),
});

const skillSchema = z.object({
  name: z.string(),
  ability: z.string(),
});

const basicActionSchema = z.object({
  name: z.string(),
  summary: z.string(),
});

const weaponSchema = z.object({
  name: z.string(),
  category: z.string(),
  damage: z.string(),
  properties: z.array(z.string()).default([]),
  weight_lb: z.number(),
});

const armorSchema = z.object({
  name: z.string(),
  category: z.string(),
  baseAC: z.number(),
  maxDex: z.union([z.string(), z.number()]),
  stealthDisadvantage: z.boolean(),
  weight_lb: z.number(),
  strengthRequirement: z.number().optional(),
});

const conditionSchema = z.object({
  name: z.string(),
  summary: z.string(),
});

const spellSchema = z.object({
  name: z.string(),
  level: z.string(),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  duration: z.string(),
  components: z.string(),
  source: z.string(),
  url: z.string(),
});

type AbilityScoreDef = z.infer<typeof abilityScoreSchema>;
type SkillDef = z.infer<typeof skillSchema>;
type BasicActionDef = z.infer<typeof basicActionSchema>;
type WeaponDef = z.infer<typeof weaponSchema>;
type ArmorDef = z.infer<typeof armorSchema>;
type ConditionDef = z.infer<typeof conditionSchema>;
type SpellDef = z.infer<typeof spellSchema>;

function parseData<T>(label: string, schema: z.ZodSchema<T>, raw: unknown[]): T[] {
  const parsed = schema.array().safeParse(raw);
  if (!parsed.success) {
    throw new Error(`5e reference load failed for ${label}: ${parsed.error.message}`);
  }
  return parsed.data;
}

function indexByName<T extends { name: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[item.name.toLowerCase()] = item;
    return acc;
  }, {});
}

export const abilityScores: AbilityScoreDef[] = parseData('abilities', abilityScoreSchema, abilityScoreData);
export const abilityScoresByAbbr: Record<string, AbilityScoreDef> = abilityScores.reduce<Record<string, AbilityScoreDef>>((acc, item) => {
  acc[item.abbr.toLowerCase()] = item;
  return acc;
}, {});
export const abilityScoresByName = indexByName(abilityScores);

export const skills: SkillDef[] = parseData('skills', skillSchema, skillData);
export const skillsByName = indexByName(skills);

export const basicActions: BasicActionDef[] = parseData('basic actions', basicActionSchema, basicActionData);
export const basicActionsByName = indexByName(basicActions);

export const weapons: WeaponDef[] = parseData('weapons', weaponSchema, weaponData);
export const weaponsByName = indexByName(weapons);

export const armor: ArmorDef[] = parseData('armor', armorSchema, armorData);
export const armorByName = indexByName(armor);

export const conditions: ConditionDef[] = parseData('conditions', conditionSchema, conditionData);
export const conditionsByName = indexByName(conditions);

export const wizardSpells: SpellDef[] = parseData('wizard spells', spellSchema, wizardSpellData);
export const wizardSpellsByName = indexByName(wizardSpells);

export type {
  AbilityScoreDef,
  SkillDef,
  BasicActionDef,
  WeaponDef,
  ArmorDef,
  ConditionDef,
  SpellDef,
};
