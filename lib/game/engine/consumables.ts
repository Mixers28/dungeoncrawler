import type { Entity } from '../../game-schema';
import type { TradeIntent } from '../intent';
import { getConsumableEffect, isConsumableItem, isUndeadOrFiend } from '../../consumables';
import { rollDice } from '../dice';
import type { TurnDraft } from './turn-draft';

/**
 * Quick-use consumables (potions, bandages, scrolls, food, thrown alchemical
 * items) and the short rest.
 *
 * Runs before the intent branches: when it handles the action, the rest of the
 * player turn is skipped, which is what `handledConsumable` reports.
 */
export function resolveConsumableUse(
  draft: TurnDraft,
  params: {
    userAction: string;
    tradeIntent: TradeIntent | null;
    activeMonster: Entity | null;
    applyDamageToActiveMonster: (damage: number) => void;
  }
): { handledConsumable: boolean } {
  const { userAction, activeMonster, applyDamageToActiveMonster } = params;
  const newState = draft.state;
  const summaryParts = draft.summary;
  const intent = { tradeIntent: params.tradeIntent };

// Quick-use consumables (potions, bandages, scrolls, food, thrown alchemical items) and short rest.
// Match by full item name first (covers the UI "use <name>" buttons), then fall back to a
// significant-word match when an explicit use-verb is present (covers free-typed "drink potion").
const lowerAction = userAction.toLowerCase();
const hasUseVerb = /\b(use|drink|quaff|apply|throw|hurl|consume|eat|drain|pour|splash|read)\b/.test(lowerAction);
const matchConsumableIdx = (): number => {
  let idx = newState.inventory.findIndex(
    i => i.quantity > 0 && isConsumableItem(i) && lowerAction.includes(i.name.toLowerCase())
  );
  if (idx >= 0) return idx;
  if (hasUseVerb) {
    idx = newState.inventory.findIndex(
      i => i.quantity > 0 && isConsumableItem(i)
        && i.name.toLowerCase().split(/[^a-z]+/).some(w => w.length >= 3 && lowerAction.includes(w))
    );
  }
  return idx;
};
// A trade command names the goods, so it must never be read as "use that
// item": "buy healing potion" used to drink the player's own potion instead
// of purchasing one.
const isTradeCommand = !!intent.tradeIntent && intent.tradeIntent.type !== 'openShop';
const consumableItemIdx = isTradeCommand ? -1 : matchConsumableIdx();
const wantsKnownConsumableKeyword = !isTradeCommand
  && /\b(bandage|potion|elixir|draught|draft)\b/i.test(userAction);
const wantsRest = consumableItemIdx < 0 && !wantsKnownConsumableKeyword && /\b(rest|camp|sleep|recover|take a break|sit down)\b/i.test(userAction);
let handledConsumable = false;

if (consumableItemIdx >= 0) {
  handledConsumable = true;
  const item = newState.inventory[consumableItemIdx];
  const effect = getConsumableEffect(item);
  const consumeOne = () => {
    const remainingQty = Math.max(0, item.quantity - 1);
    newState.inventory = remainingQty <= 0
      ? newState.inventory.filter((_, idx) => idx !== consumableItemIdx)
      : newState.inventory.map((it, idx) => idx === consumableItemIdx ? { ...it, quantity: remainingQty } : it);
  };
  if (!effect) {
    summaryParts.push(`You examine ${item.name}, but aren't sure how to use it.`);
  } else if (effect.kind === 'heal') {
    const heal = rollDice(effect.dice);
    newState.hp = Math.min(newState.maxHp, newState.hp + heal);
    consumeOne();
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used ${item.name} (${heal} HP) at ${newState.location}`].slice(-10);
    summaryParts.push(`You ${effect.verb} ${item.name}, recovering ${heal} HP.`);
  } else if (effect.kind === 'buff') {
    newState.activeEffects = [
      ...(newState.activeEffects || []),
      { name: effect.effectName, type: effect.effectType, value: effect.value, expiresAtTurn: (newState.turnCounter || 0) + effect.durationTurns }
    ];
    consumeOne();
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used ${item.name} at ${newState.location}`].slice(-10);
    const bonusLabel = effect.effectType === 'ac_bonus' ? 'AC' : 'attack rolls';
    summaryParts.push(`You ${effect.verb} ${item.name}, gaining +${effect.value} to ${bonusLabel} for a short while.`);
  } else if (effect.kind === 'flavor') {
    newState.activeEffects = [
      ...(newState.activeEffects || []),
      { name: effect.effectName, type: 'buff', expiresAtTurn: (newState.turnCounter || 0) + effect.durationTurns }
    ];
    consumeOne();
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used ${item.name} at ${newState.location}`].slice(-10);
    summaryParts.push(effect.message(item.name));
  } else {
    // Offensive thrown item (Acid, Alchemist's Fire, Holy Water, Oil) — needs an alive target.
    if (!activeMonster || activeMonster.status !== 'alive') {
      summaryParts.push(`You ready ${item.name}, but there is no target in range.`);
    } else if (effect.undeadFiendOnly && !isUndeadOrFiend(activeMonster.name)) {
      consumeOne();
      newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used ${item.name} at ${newState.location}`].slice(-10);
      summaryParts.push(`You ${effect.verb} ${item.name} at ${activeMonster.name}, but it has no effect on the living.`);
    } else {
      const dmg = rollDice(effect.dice);
      applyDamageToActiveMonster(dmg);
      consumeOne();
      newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used ${item.name} (${dmg} ${effect.damageType}) at ${newState.location}`].slice(-10);
      summaryParts.push(`You ${effect.verb} ${item.name} at ${activeMonster.name}, dealing ${dmg} ${effect.damageType} damage.`);
    }
  }
} else if (wantsKnownConsumableKeyword) {
  handledConsumable = true;
  if (/bandage/i.test(userAction)) {
    summaryParts.push("You fumble for a bandage, but you have none left.");
  } else {
    summaryParts.push("You fumble for a potion, but you have none left.");
  }
} else if (wantsRest) {
  handledConsumable = true;
  const enemiesNearby = newState.nearbyEntities.some(e => e.status === 'alive');
  if (enemiesNearby || newState.isCombatActive) {
    summaryParts.push("You cannot rest while enemies are nearby.");
  } else if (newState.hp >= newState.maxHp) {
    summaryParts.push("You are already at full health. There is no need to rest.");
  } else {
    const healAmount = Math.ceil(newState.maxHp * 0.25);
    newState.hp = Math.min(newState.maxHp, newState.hp + healAmount);
    summaryParts.push(`You take a short rest and tend your wounds, recovering ${healAmount} HP. (${newState.hp}/${newState.maxHp} HP)`);
  }
}

  return { handledConsumable };
}
