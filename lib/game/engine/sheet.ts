// Character-sheet concerns: derived AC and attack bonus, equipment resolution,
// and the inventory mutations that equip/drop drive.
import type { GameState } from '../../game-schema';
import { armorByName, clericSpellsByName, skillsByName, weaponsByName, wizardSpellsByName } from '../../5e/reference';
import {
  normalizeWeaponName,
  resolveArmorId,
  resolveWeaponId,
  weaponsById,
  weaponsByName as equipmentWeaponsByName,
} from '../../items';
import { WEAPON_TABLE } from '../../rules';
import { getClassReference } from '../../5e/classes';
import { getActorSheetFields, type TurnContext } from '../turn-context';
import { computeArmorClassFromInventory } from '../state';
import { normalizeName, normalizeSpellName } from './shared';

export function getPlayerAc(state: GameState, baseAc: number): number {
  const effectBonus = Math.max(
    0,
    ...(state.activeEffects || [])
      .filter(e => e.type === 'ac_bonus' && e.value !== undefined)
      .map(e => e.value as number)
  );
  return baseAc + effectBonus + (state.tempAcBonus || 0);
}

export function getPlayerAttackBonus(state: GameState): number {
  return Math.max(
    0,
    ...(state.activeEffects || [])
      .filter(e => e.type === 'attack_bonus' && e.value !== undefined)
      .map(e => e.value as number)
  );
}

export function isShieldName(name: string): boolean {
  return armorByName[name.toLowerCase()]?.category?.toLowerCase() === 'shield';
}

export function summarizeInventory(inventory: GameState["inventory"]): { summary: string; items: string[] } {
  if (!inventory || inventory.length === 0) {
    return { summary: "Unarmed; nothing notable carried.", items: [] };
  }

  const primaryWeapon =
    inventory.find(i => i.type === 'weapon' && i.equipped)?.name ||
    inventory.find(i => i.type === 'weapon')?.name;
  const armor =
    inventory.find(i => i.type === 'armor' && i.equipped && !isShieldName(i.name))?.name ||
    inventory.find(i => i.type === 'armor' && !isShieldName(i.name))?.name;
  const extras = inventory
    .filter(i => i.type !== 'weapon' && i.type !== 'armor')
    .slice(0, 1)
    .map(i => i.name);

  const names = [primaryWeapon, armor, ...extras].filter(Boolean) as string[];
  const summary = names.length > 0 ? names.join(' and ') : "Basic gear only.";
  return { summary, items: names };
}

export function getSkillModifier(state: GameState, skillName: string): number {
  if (!skillName) return 0;
  const hasSkill = (state.skills || []).some(skill => skill.toLowerCase() === skillName.toLowerCase());
  return hasSkill ? 2 : 0;
}

export function getEquippedWeaponDamageDice(state: GameState, fallbackName: string): string {
  const fallbackId = resolveWeaponId(fallbackName);
  if (fallbackId) {
    const def = weaponsById[fallbackId];
    if (def?.damageDice) return def.damageDice;
  }
  const byName = equipmentWeaponsByName[normalizeWeaponName(fallbackName)];
  if (byName?.damageDice) return byName.damageDice;
  if (state.equippedWeaponId) {
    const def = weaponsById[state.equippedWeaponId];
    if (def?.damageDice) return def.damageDice;
  }
  return getWeaponDamageDice(fallbackName);
}

export function getBaseAcFromEquipped(state: GameState): number {
  if (!state.inventory || state.inventory.length === 0) return state.ac;
  const abilityScores = state.abilityScores || {};
  return computeArmorClassFromInventory(state.inventory, abilityScores);
}

export function findInventoryItemIndex(
  inventory: GameState["inventory"],
  itemName: string,
  type?: GameState["inventory"][number]["type"]
): number {
  const requested = normalizeName(itemName);
  if (!requested) return -1;
  const candidates = inventory
    .map((item, idx) => ({ item, idx, normalized: normalizeName(item.name) }))
    .filter(({ item }) => !type || item.type === type);

  const exact = candidates.find(({ normalized }) => normalized === requested);
  if (exact) return exact.idx;

  const partial = candidates.find(({ normalized }) =>
    normalized.includes(requested) || requested.includes(normalized)
  );
  return partial?.idx ?? -1;
}

export function refreshEquipmentAfterInventoryChange(state: GameState) {
  const equippedWeapon = state.inventory.find(item => item.type === 'weapon' && item.equipped);
  const fallbackWeapon = state.inventory.find(item => item.type === 'weapon');
  const weaponToEquip = equippedWeapon || fallbackWeapon;

  state.inventory = state.inventory.map(item => {
    if (item.type !== 'weapon') return item;
    return { ...item, equipped: weaponToEquip ? item.id === weaponToEquip.id : false };
  });
  state.equippedWeaponId = weaponToEquip ? resolveWeaponId(weaponToEquip.name) : undefined;

  const equippedBodyArmor = state.inventory.find(item =>
    item.type === 'armor' && item.equipped && !isShieldName(item.name)
  );
  const fallbackBodyArmor = state.inventory.find(item => item.type === 'armor' && !isShieldName(item.name));
  const bodyArmorToEquip = equippedBodyArmor || fallbackBodyArmor;

  const equippedShield = state.inventory.find(item =>
    item.type === 'armor' && item.equipped && isShieldName(item.name)
  );
  const fallbackShield = state.inventory.find(item => item.type === 'armor' && isShieldName(item.name));
  const shieldToEquip = equippedShield || fallbackShield;

  state.inventory = state.inventory.map(item => {
    if (item.type !== 'armor') return item;
    if (isShieldName(item.name)) {
      return { ...item, equipped: shieldToEquip ? item.id === shieldToEquip.id : false };
    }
    return { ...item, equipped: bodyArmorToEquip ? item.id === bodyArmorToEquip.id : false };
  });
  state.equippedArmorId = bodyArmorToEquip ? resolveArmorId(bodyArmorToEquip.name) : undefined;
  state.ac = computeArmorClassFromInventory(state.inventory, state.abilityScores || {});
}

export function equipInventoryItem(state: GameState, itemName: string): string {
  const idx = findInventoryItemIndex(state.inventory, itemName);
  if (idx < 0) return `You do not have ${itemName} in your pack.`;

  const item = state.inventory[idx];
  if (item.type !== 'weapon' && item.type !== 'armor') {
    return `${item.name} cannot be equipped.`;
  }

  if (item.type === 'weapon') {
    state.inventory = state.inventory.map((entry, entryIdx) =>
      entry.type === 'weapon' ? { ...entry, equipped: entryIdx === idx } : entry
    );
    state.equippedWeaponId = resolveWeaponId(item.name);
    return `You equip ${item.name}.`;
  }

  const equippingShield = isShieldName(item.name);
  state.inventory = state.inventory.map((entry, entryIdx) => {
    if (entry.type !== 'armor') return entry;
    const entryIsShield = isShieldName(entry.name);
    if (equippingShield) {
      return entryIsShield ? { ...entry, equipped: entryIdx === idx } : entry;
    }
    return entryIsShield ? entry : { ...entry, equipped: entryIdx === idx };
  });
  if (!equippingShield) state.equippedArmorId = resolveArmorId(item.name);
  state.ac = computeArmorClassFromInventory(state.inventory, state.abilityScores || {});
  return `You equip ${item.name}. Your AC is now ${state.ac}.`;
}

export function dropInventoryItem(state: GameState, itemName: string): string {
  const idx = findInventoryItemIndex(state.inventory, itemName);
  if (idx < 0) return `You do not have ${itemName} in your pack.`;

  const item = state.inventory[idx];
  if (item.type === 'key') {
    return `${item.name} feels too important to discard.`;
  }

  const remainingQty = Math.max(0, item.quantity - 1);
  state.inventory = remainingQty > 0
    ? state.inventory.map((entry, entryIdx) =>
        entryIdx === idx ? { ...entry, quantity: remainingQty } : entry
      )
    : state.inventory.filter((_, entryIdx) => entryIdx !== idx);

  if (item.equipped || item.type === 'weapon' || item.type === 'armor') {
    refreshEquipmentAfterInventoryChange(state);
  }
  state.inventoryChangeLog = [...state.inventoryChangeLog, `Dropped ${item.name} at ${state.location}`].slice(-10);
  return remainingQty > 0
    ? `You drop one ${item.name}. ${remainingQty} remain.`
    : `You drop ${item.name}.`;
}

export function getWeaponDamageDice(name: string | undefined): string {
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


/**
 * `check sheet`: a factual character summary enriched from the 5e reference
 * layer. Formatting only — it reads the actor and invents nothing.
 */
export function describeCharacterSheet(context: TurnContext): string {
  // All sheet facts are enriched from the 5e reference layer, never invented.
  const sheet = getActorSheetFields(context);
  const sheetClassKey = (sheet.character?.class || 'fighter').toLowerCase();
  const sheetSpellCatalog = sheetClassKey === 'cleric' ? clericSpellsByName : wizardSpellsByName;
  const sheetClassRef = getClassReference(sheetClassKey);
  const describeSkill = (raw: string) => {
    const ref = skillsByName[raw.toLowerCase().replace(/_/g, ' ')];
    return ref ? `${ref.name} (${ref.ability})` : raw;
  };
  const describeSpell = (raw: string) => {
    const def = sheetSpellCatalog[normalizeSpellName(raw)];
    if (!def) return raw;
    const level = def.level.toLowerCase() === 'cantrip' ? 'cantrip' : `${def.level} level`;
    return `${def.name} (${level})`;
  };
  const skills = sheet.skills?.length ? sheet.skills.map(describeSkill).join(', ') : 'None';
  const equippedWeapon = sheet.inventory.find(i => i.type === 'weapon' && i.equipped)
    || sheet.inventory.find(i => i.type === 'weapon');
  const weaponRef = equippedWeapon ? weaponsByName[normalizeWeaponName(equippedWeapon.name)] : undefined;
  const weaponText = equippedWeapon
    ? (weaponRef ? `${equippedWeapon.name} — ${weaponRef.damage} (${weaponRef.category})` : equippedWeapon.name)
    : 'None';
  const equippedArmor = sheet.inventory.find(i => i.type === 'armor' && i.equipped)
    || sheet.inventory.find(i => i.type === 'armor');
  const armorRef = equippedArmor ? armorByName[equippedArmor.name.toLowerCase()] : undefined;
  const armorText = equippedArmor
    ? (armorRef ? `${equippedArmor.name} — AC ${armorRef.baseAC} (${armorRef.category})` : equippedArmor.name)
    : 'None';
  const profText = `weapons — ${sheetClassRef.weaponProficiencyTokens.join(', ') || 'none'}; armor — ${sheetClassRef.armorProficiencyTokens.join(', ') || 'none'}`;
  const known = sheet.knownSpells?.length ? sheet.knownSpells.map(describeSpell).join(', ') : 'None';
  const prepared = sheet.preparedSpells?.length ? sheet.preparedSpells.map(describeSpell).join(', ') : 'None';
  const slotText = Object.entries(sheet.spellSlots || {})
    .map(([lvl, data]) => `${lvl.replace('_', ' ')}: ${data.current}/${data.max}`)
    .join('; ');
  return `Class: ${sheetClassRef.name}. Skills: ${skills}. Equipped weapon: ${weaponText}. Armor: ${armorText}. Proficiencies: ${profText}. Spells known: ${known}. Spells prepared: ${prepared}. Slots: ${slotText || 'None'}.`
}
