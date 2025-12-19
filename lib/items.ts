import weapons from '../data/5e/weapons.json';
import armor from '../data/5e/armor.json';

export interface WeaponDef {
  id: string;
  name: string;
  damageDice: string;
  cost?: number;
  minLevel?: number;
}

export interface ArmorDef {
  id: string;
  name: string;
  baseAC: number;
  cost?: number;
  minLevel?: number;
}

function normalizeItemId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readCost(raw: unknown): number | undefined {
  if (!raw || typeof raw !== 'number') return undefined;
  return Number.isFinite(raw) ? raw : undefined;
}

function parseDamageDice(damage: string | undefined): string {
  if (!damage) return '1d4';
  const match = damage.match(/\d+d\d+/i);
  return match ? match[0] : '1d4';
}

const weaponDefs: WeaponDef[] = (weapons as Array<Record<string, unknown>>).map(raw => ({
  id: normalizeItemId(String(raw.name || 'weapon')),
  name: String(raw.name || 'Weapon'),
  damageDice: parseDamageDice(String(raw.damage || '1d4')),
  cost: readCost(raw.cost ?? raw.cost_gp),
  minLevel: typeof raw.minLevel === 'number' ? raw.minLevel : undefined,
}));

const armorDefs: ArmorDef[] = (armor as Array<Record<string, unknown>>).map(raw => ({
  id: normalizeItemId(String(raw.name || 'armor')),
  name: String(raw.name || 'Armor'),
  baseAC: typeof raw.baseAC === 'number' ? raw.baseAC : 10,
  cost: readCost(raw.cost ?? raw.cost_gp),
  minLevel: typeof raw.minLevel === 'number' ? raw.minLevel : undefined,
}));

export const weaponsById = weaponDefs.reduce<Record<string, WeaponDef>>((acc, def) => {
  acc[def.id] = def;
  return acc;
}, {});

export const weaponsByName = weaponDefs.reduce<Record<string, WeaponDef>>((acc, def) => {
  acc[def.name.toLowerCase()] = def;
  return acc;
}, {});

export const armorById = armorDefs.reduce<Record<string, ArmorDef>>((acc, def) => {
  acc[def.id] = def;
  return acc;
}, {});

export const armorByName = armorDefs.reduce<Record<string, ArmorDef>>((acc, def) => {
  acc[def.name.toLowerCase()] = def;
  return acc;
}, {});

export function resolveWeaponId(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return weaponsByName[name.toLowerCase()]?.id;
}

export function resolveArmorId(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return armorByName[name.toLowerCase()]?.id;
}
