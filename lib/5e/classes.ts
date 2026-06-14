import { armor, weapons, skills as skillList } from './reference';

export type ClassReference = {
  key: string;
  name: string;
  allowedWeapons: string[];
  allowedArmor: string[];
  skills: string[];
};

function filterWeaponsByCategory(prefixes: string[]) {
  return weapons
    .filter(w => prefixes.some(prefix => w.category.toLowerCase().startsWith(prefix.toLowerCase())))
    .map(w => w.name);
}

function filterArmorByCategory(categories: string[]) {
  return armor
    .filter(a => categories.some(cat => a.category.toLowerCase() === cat.toLowerCase()))
    .map(a => a.name);
}

const allSkills = skillList.map(s => s.name);

export const classReferenceByKey: Record<string, ClassReference> = {
  fighter: {
    key: 'fighter',
    name: 'Fighter',
    allowedWeapons: filterWeaponsByCategory(['simple', 'martial']),
    allowedArmor: filterArmorByCategory(['light', 'medium', 'heavy', 'shield']),
    skills: ['Athletics', 'Perception', 'Survival'],
  },
  rogue: {
    key: 'rogue',
    name: 'Rogue',
    allowedWeapons: filterWeaponsByCategory(['simple']).concat(['Rapier', 'Shortsword', 'Hand Crossbow']),
    allowedArmor: filterArmorByCategory(['light']),
    skills: ['Stealth', 'Sleight of Hand', 'Perception', 'Acrobatics'],
  },
  cleric: {
    key: 'cleric',
    name: 'Cleric',
    allowedWeapons: filterWeaponsByCategory(['simple']),
    allowedArmor: filterArmorByCategory(['light', 'medium', 'shield']),
    skills: ['Insight', 'Medicine', 'Religion'],
  },
  wizard: {
    key: 'wizard',
    name: 'Wizard',
    allowedWeapons: ['Dagger', 'Quarterstaff', 'Light Crossbow'],
    allowedArmor: [],
    skills: ['Arcana', 'History', 'Investigation'],
  },
};

export function getClassReference(key: string): ClassReference {
  return classReferenceByKey[key] ?? {
    key,
    name: key,
    allowedWeapons: filterWeaponsByCategory(['simple']),
    allowedArmor: filterArmorByCategory(['light']),
    skills: allSkills.slice(0, 2),
  };
}
