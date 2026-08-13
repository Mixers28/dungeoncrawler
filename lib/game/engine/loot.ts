import type { GameState } from '../../game-schema';
import { rollLoot } from '../../loot';
import {
  addActorInventoryItem,
  adjustActorGold,
  markSessionEntityLooted,
  syncTurnContextFromGameState,
} from '../turn-context';
import { nextItemId, normalizeName } from './shared';
import type { TurnDraft } from './turn-draft';

const LOOT_VERBS = /(loot|rummage|pick over|salvage)/i;

const MONSTER_LOOT_TABLES: Record<string, string> = {
  'skeleton': '5e_minor_undead_treasure',
  'zombie': '5e_minor_undead_treasure',
  'skeleton archer': '5e_minor_undead_treasure',
  'armoured zombie': '5e_minor_undead_treasure',
  'fallen knight': '5e_major_undead_boss_treasure',
  'cultist acolyte': '5e_minor_cultist_treasure',
};

function resolveLootTable(corpseName: string): string | undefined {
  const corpseKey = normalizeName(corpseName);
  const direct = MONSTER_LOOT_TABLES[corpseKey]
    || Object.entries(MONSTER_LOOT_TABLES).find(([key]) => corpseKey.includes(key))?.[1];
  if (direct) return direct;
  if (corpseKey.includes('skeleton') || corpseKey.includes('zombie')) return '5e_minor_undead_treasure';
  if (corpseKey.includes('cultist')) return '5e_minor_cultist_treasure';
  return undefined;
}

/**
 * Section 8b: loot a corpse named in the player's action.
 *
 * Returns the two flags the caller uses for narration; all state changes are
 * applied to `draft` in place.
 */
export function resolveCorpseLooting(
  draft: TurnDraft,
  userAction: string
): { attemptedLoot: boolean; foundLootItems: boolean } {
  const { state, context } = draft;
  const attemptedLoot = LOOT_VERBS.test(userAction);

  const lootTarget = normalizeName(
    userAction
      .replace(/\b(loot|rummage|pick over|salvage)\b/gi, '')
      .replace(/\b(the|a|an|corpse|body|monster|remains)\b/gi, '')
      .trim()
  );
  const corpseMatches = (entity: GameState['nearbyEntities'][number], exact: boolean): boolean => {
    if (entity.status !== 'dead' || entity.name.toLowerCase().includes('looted')) return false;
    if (!lootTarget) return true;
    const corpseName = normalizeName(entity.name.replace(/\s*\(looted\)\s*$/i, ''));
    // Exact match first: "loot skeleton archer" must not grab the plain
    // Skeleton via substring overlap and leave the Archer lootable again.
    return exact
      ? corpseName === lootTarget
      : corpseName.includes(lootTarget) || lootTarget.includes(corpseName);
  };

  let deadCorpseIndex = state.nearbyEntities.findIndex(entity => corpseMatches(entity, true));
  if (lootTarget && deadCorpseIndex < 0) {
    deadCorpseIndex = state.nearbyEntities.findIndex(entity => corpseMatches(entity, false));
  }
  const deadCorpse = deadCorpseIndex >= 0 ? state.nearbyEntities[deadCorpseIndex] : null;
  if (!attemptedLoot || !deadCorpse) return { attemptedLoot, foundLootItems: false };

  syncTurnContextFromGameState(context, state);
  const table = resolveLootTable(deadCorpse.name);
  const loot = table ? rollLoot(table) : null;
  let goldFind = 0;
  const newItems: GameState['inventory'] = [];

  if (loot) {
    goldFind = loot.coins.gp || 0;
    if (goldFind > 0) state.gold = adjustActorGold(context, goldFind);
    for (const item of loot.items) {
      newItems.push({
        id: nextItemId('loot'),
        name: item.id.replace(/_/g, ' '),
        type: 'misc',
        quantity: item.quantity,
        equipped: false,
      });
    }
  } else {
    goldFind = Math.max(1, Math.floor(Math.random() * 6));
    newItems.push({
      id: nextItemId('loot'),
      name: `${deadCorpse.name} Remnant`,
      type: 'misc',
      quantity: 1,
      equipped: false,
    });
    state.gold = adjustActorGold(context, goldFind);
  }

  for (const item of newItems) {
    state.inventory = addActorInventoryItem(context, item);
  }

  const corpseDisplayName = deadCorpse.name.replace(/\s*\(looted\)\s*$/i, '');
  if (newItems.length > 0) {
    draft.events.push({
      type: 'loot',
      targetName: corpseDisplayName,
      items: newItems.map(item => ({ name: item.name, quantity: item.quantity })),
    });
  }
  if (goldFind > 0) {
    draft.events.push({ type: 'coins', targetName: corpseDisplayName, amount: goldFind });
  }

  state.nearbyEntities = markSessionEntityLooted(context, deadCorpseIndex);
  state.inventoryChangeLog = [
    ...state.inventoryChangeLog,
    `Looted ${deadCorpse.name}: +${goldFind} gold${newItems.length ? ', +' + newItems.map(i => `${i.quantity}x ${i.name}`).join(', ') : ''}`,
  ].slice(-10);

  const parts: string[] = [];
  if (goldFind > 0) parts.push(`${goldFind} gold`);
  if (newItems.length > 0) parts.push(newItems.map(i => `${i.quantity}x ${i.name}`).join(', '));
  draft.summary.push(`You loot the ${deadCorpse.name}${parts.length ? ', gaining ' + parts.join(' and ') : '.'}`);

  return { attemptedLoot, foundLootItems: goldFind > 0 || newItems.length > 0 };
}
