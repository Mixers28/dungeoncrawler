// Consumable item catalog + resolver, grounded in the 5e SRD (2024) Adventuring Gear table.
// Effects are deterministic. Self-effects (heal/buff/flavor) are applied to the player;
// offensive thrown items (damage) are resolved against the active monster in the engine.

export type ConsumableEffect =
  | { kind: 'heal'; dice: string; verb: string }
  | { kind: 'buff'; effectName: string; effectType: 'ac_bonus' | 'attack_bonus'; value: number; durationTurns: number; verb: string }
  | { kind: 'flavor'; effectName: string; durationTurns: number; verb: string; message: (name: string) => string }
  | { kind: 'damage'; dice: string; damageType: string; verb: string; undeadFiendOnly?: boolean };

// Normalize an item name for matching: lowercase, drop parenthetical qualifiers like "(vial)",
// collapse separators/whitespace. e.g. "Acid (vial)" -> "acid", "Greater_Healing-Potion" -> "greater healing potion".
const normalize = (name: string): string =>
  name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

type CatalogEntry = { match: RegExp; effect: ConsumableEffect };

// Order matters: more specific patterns must precede generic ones (e.g. "greater healing potion" before "potion").
const CATALOG: CatalogEntry[] = [
  // --- Healing ---
  { match: /\bbandage\b/, effect: { kind: 'heal', dice: '6', verb: 'apply' } },
  { match: /greater (healing )?potion|potion of greater healing/, effect: { kind: 'heal', dice: '4d4+4', verb: 'drink' } },
  { match: /healer'?s kit|healers kit/, effect: { kind: 'heal', dice: '10', verb: 'use' } },
  { match: /\b(potion|elixir|draught|draft)\b/, effect: { kind: 'heal', dice: '2d4+2', verb: 'drink' } },
  { match: /\bration|\bfood\b|\bbread\b|\bmeal\b|provision/, effect: { kind: 'heal', dice: '1d4+1', verb: 'eat' } },

  // --- Offensive thrown items (5e SRD 2024 damage values) ---
  { match: /\bacid\b/, effect: { kind: 'damage', dice: '2d6', damageType: 'acid', verb: 'hurl' } },
  { match: /alchemist'?s fire|alchemists fire/, effect: { kind: 'damage', dice: '1d4', damageType: 'fire', verb: 'hurl' } },
  { match: /holy water/, effect: { kind: 'damage', dice: '2d8', damageType: 'radiant', verb: 'splash', undeadFiendOnly: true } },
  { match: /\boil\b/, effect: { kind: 'damage', dice: '1d4', damageType: 'fire', verb: 'hurl' } },

  // --- Utility (flavor-only buff: no poison-save system to enforce against yet) ---
  { match: /antitoxin/, effect: { kind: 'flavor', effectName: 'Antitoxin', durationTurns: 10, verb: 'drink', message: (n) => `You drink ${n}; your body steels against poisons.` } },

  // --- Scrolls (generic protective magic; real spell-scroll casting is out of scope) ---
  { match: /scroll/, effect: { kind: 'buff', effectName: 'Scroll Magic', effectType: 'ac_bonus', value: 1, durationTurns: 2, verb: 'read' } },
];

// Sane defaults so any item carrying a consumable type still resolves to *something* usable,
// even if its name isn't in the catalog (prevents undefined effects from crashing the turn).
const FALLBACK_BY_TYPE: Record<string, ConsumableEffect> = {
  potion: { kind: 'heal', dice: '2d4+2', verb: 'drink' },
  food: { kind: 'heal', dice: '1d4+1', verb: 'eat' },
  scroll: { kind: 'buff', effectName: 'Scroll Magic', effectType: 'ac_bonus', value: 1, durationTurns: 2, verb: 'read' },
};

/** Resolve a consumable effect purely by item name. Returns undefined for non-consumable names. */
export function resolveConsumableEffect(itemName: string): ConsumableEffect | undefined {
  const name = normalize(itemName);
  return CATALOG.find(entry => entry.match.test(name))?.effect;
}

/**
 * Resolve a usable effect for an inventory item, falling back to a type-based default
 * when the name isn't catalogued. Never returns undefined for a consumable-typed item.
 */
export function getConsumableEffect(item: { name: string; type: string }): ConsumableEffect | undefined {
  return resolveConsumableEffect(item.name) ?? FALLBACK_BY_TYPE[item.type];
}

/** True if the item can be used for an effect (by catalogued name, or by consumable type). */
export function isConsumableItem(item: { name: string; type: string }): boolean {
  if (resolveConsumableEffect(item.name)) return true;
  return item.type === 'potion' || item.type === 'scroll' || item.type === 'food';
}

/** Heuristic for whether a monster is undead or a fiend (e.g. for Holy Water targeting). */
export function isUndeadOrFiend(name: string): boolean {
  return /skeleton|skeletal|zombie|undead|ghoul|ghast|wight|wraith|spectre|specter|lich|vampire|revenant|mummy|\bbone\b|demon|devil|fiend|imp|hell ?hound/i.test(name);
}
