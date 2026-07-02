import { z } from 'zod';
import classData from '../../data/5e/classes.json';
import { armor, weapons, skills as skillList, skillsByName, weaponsByName, armorByName } from './reference';

export type ClassReference = {
  key: string;
  name: string;
  allowedWeapons: string[];
  allowedArmor: string[];
  skills: string[];
  /** Raw data tokens (e.g. "simple", "martial", "light") for compact display. */
  weaponProficiencyTokens: string[];
  armorProficiencyTokens: string[];
};

const classSchema = z.object({
  key: z.string(),
  name: z.string(),
  weaponProficiencies: z.array(z.string()),
  armorProficiencies: z.array(z.string()),
  skills: z.array(z.string()),
});

// Proficiency tokens are either a category prefix ("simple", "martial", "light",
// "shield") that expands to every item in that category, or an exact item name.
// Unknown tokens fail at load so bad data can't silently strip proficiencies.

function resolveWeaponToken(token: string): string[] {
  const lower = token.toLowerCase();
  const byCategory = weapons
    .filter(w => w.category.toLowerCase().startsWith(lower))
    .map(w => w.name);
  if (byCategory.length > 0) return byCategory;
  const named = weaponsByName[lower];
  if (named) return [named.name];
  throw new Error(`5e class data: unknown weapon proficiency token "${token}"`);
}

function resolveArmorToken(token: string): string[] {
  const lower = token.toLowerCase().replace(/s$/, '');
  const byCategory = armor
    .filter(a => a.category.toLowerCase() === lower)
    .map(a => a.name);
  if (byCategory.length > 0) return byCategory;
  const named = armorByName[token.toLowerCase()];
  if (named) return [named.name];
  throw new Error(`5e class data: unknown armor proficiency token "${token}"`);
}

function resolveSkill(name: string): string {
  const skill = skillsByName[name.toLowerCase()];
  if (!skill) throw new Error(`5e class data: unknown skill "${name}"`);
  return skill.name;
}

function buildClassReference(def: z.infer<typeof classSchema>): ClassReference {
  const allowedWeapons = Array.from(new Set(def.weaponProficiencies.flatMap(resolveWeaponToken)));
  const allowedArmor = Array.from(new Set(def.armorProficiencies.flatMap(resolveArmorToken)));
  return {
    key: def.key,
    name: def.name,
    allowedWeapons,
    allowedArmor,
    skills: def.skills.map(resolveSkill),
    weaponProficiencyTokens: def.weaponProficiencies,
    armorProficiencyTokens: def.armorProficiencies,
  };
}

const parsedClasses = classSchema.array().safeParse(classData);
if (!parsedClasses.success) {
  throw new Error(`5e reference load failed for classes: ${parsedClasses.error.message}`);
}

export const classReferenceByKey: Record<string, ClassReference> = parsedClasses.data.reduce<Record<string, ClassReference>>(
  (acc, def) => {
    acc[def.key] = buildClassReference(def);
    return acc;
  },
  {}
);

const allSkills = skillList.map(s => s.name);

export function getClassReference(key: string): ClassReference {
  return classReferenceByKey[key] ?? {
    key,
    name: key,
    allowedWeapons: resolveWeaponToken('simple'),
    allowedArmor: resolveArmorToken('light'),
    skills: allSkills.slice(0, 2),
    weaponProficiencyTokens: ['simple'],
    armorProficiencyTokens: ['light'],
  };
}
