import type { GameState, NarrationMode } from '../../game-schema';
import type { TradeIntent } from '../intent';
import { computeArmorClassFromInventory } from '../state';
import {
  armorById,
  armorByName as equipmentArmorByName,
  resolveArmorId,
  resolveWeaponId,
  weaponsById,
  weaponsByName as equipmentWeaponsByName,
} from '../../items';
import { getTraderAtLocation } from '../../traders';
import {
  addOrStackActorInventoryItem,
  adjustActorGold,
  decrementActorInventoryItemAtIndex,
  syncTurnContextFromGameState,
  type TurnContext,
} from '../turn-context';
import { isShieldName } from './sheet';
import { nextItemId } from './shared';

// Traders key their stock by snake_case item id, but players type prose:
// "buy healing potion" must match `healing_potion`.
const tradeKey = (value: string) => value.trim().toLowerCase().replace(/[\s_]+/g, ' ');

// Trading with location-bound merchants.
export function resolveTradeIntent(
  state: GameState,
  tradeIntent: TradeIntent,
  context: TurnContext
): { eventSummary: string; narrationMode: NarrationMode } {
  syncTurnContextFromGameState(context, state);
  const trader = getTraderAtLocation(state.location);
  const narrationMode: NarrationMode = 'GENERAL';

  if (!trader) {
    return { eventSummary: 'There is no trader here to do business with.', narrationMode };
  }

  if (tradeIntent.type === 'openShop') {
    const itemsList = trader.inventory.map(item => `${tradeKey(item.itemId)} (${item.price}g)`).join(', ');
    const eventSummary = `You approach ${trader.name}. For sale: ${itemsList}. You have ${state.gold} gold.`;
    return { eventSummary, narrationMode };
  }

  if (tradeIntent.type === 'buy' && tradeIntent.itemName) {
    const itemName = tradeKey(tradeIntent.itemName);
    const invEntry = trader.inventory.find(item => tradeKey(item.itemId) === itemName);
    if (!invEntry) {
      const eventSummary = `${trader.name} does not sell ${tradeIntent.itemName}.`;
      return { eventSummary, narrationMode };
    }
    if (state.gold < invEntry.price) {
      const eventSummary = `You cannot afford ${tradeKey(invEntry.itemId)} (costs ${invEntry.price} gold, you have ${state.gold}).`;
      return { eventSummary, narrationMode };
    }

    state.gold = adjustActorGold(context, -invEntry.price);
    const weaponDef = weaponsById[invEntry.itemId] || equipmentWeaponsByName[invEntry.itemId];
    const armorDef = armorById[invEntry.itemId] || equipmentArmorByName[invEntry.itemId];
    const displayName = weaponDef?.name || armorDef?.name || invEntry.itemId.replace(/_/g, ' ');
    const itemType = weaponDef ? 'weapon' : armorDef ? 'armor' : 'potion';
    state.inventory = addOrStackActorInventoryItem(context, {
      id: nextItemId('shop'),
      name: displayName,
      type: itemType,
      quantity: 1,
      equipped: false,
    });

    if (weaponDef) {
      state.inventory = state.inventory.map(item =>
        item.type === 'weapon' ? { ...item, equipped: item.name.toLowerCase() === displayName.toLowerCase() } : item
      );
      state.equippedWeaponId = resolveWeaponId(displayName);
    }
    if (armorDef) {
      const buyingShield = isShieldName(displayName);
      state.inventory = state.inventory.map(item => {
        if (item.type !== 'armor') return item;
        const itemIsShield = isShieldName(item.name);
        if (buyingShield) {
          return itemIsShield
            ? { ...item, equipped: item.name.toLowerCase() === displayName.toLowerCase() }
            : item;
        }
        return itemIsShield ? item : { ...item, equipped: item.name.toLowerCase() === displayName.toLowerCase() };
      });
      if (!buyingShield) state.equippedArmorId = resolveArmorId(displayName);
      state.ac = computeArmorClassFromInventory(state.inventory, state.abilityScores || {});
    }

    const eventSummary = `You buy ${displayName} from ${trader.name} for ${invEntry.price} gold. You now have ${state.gold} gold.`;
    return { eventSummary, narrationMode };
  }

  if (tradeIntent.type === 'sell' && tradeIntent.itemName) {
    const itemName = tradeKey(tradeIntent.itemName);
    const invIdx = state.inventory.findIndex(item => tradeKey(item.name) === itemName);
    if (invIdx < 0) {
      const eventSummary = `You do not have ${tradeIntent.itemName} to sell.`;
      return { eventSummary, narrationMode };
    }

    const invItem = state.inventory[invIdx];
    const traderPrice = trader.inventory.find(item => tradeKey(item.itemId) === itemName)?.price;
    const basePrice = traderPrice ?? 2;
    const sellPrice = Math.max(1, Math.floor(basePrice * trader.buybackRate));
    state.gold = adjustActorGold(context, sellPrice);
    state.inventory = decrementActorInventoryItemAtIndex(context, invIdx);
    const eventSummary = `You sell ${invItem.name} for ${sellPrice} gold. You now have ${state.gold} gold.`;
    return { eventSummary, narrationMode };
  }

  return { eventSummary: 'You fail to complete any trade.', narrationMode };
}
