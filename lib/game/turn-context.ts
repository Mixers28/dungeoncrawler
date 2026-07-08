import type { Entity } from '../game-schema';
import { type CharacterState, type GameState, type SessionState } from '../game-schema';
import { composeGameStateForSolo, splitGameStateForSolo, splitGameStateForSoloTrusted } from './state-split';

export type TurnContext = {
  session: SessionState;
  actor: CharacterState;
};

export type ActorSheetFields = Pick<
  CharacterState,
  | 'character'
  | 'skills'
  | 'knownSpells'
  | 'preparedSpells'
  | 'spellSlots'
  | 'inventory'
  | 'equippedWeaponId'
  | 'equippedArmorId'
  | 'abilityScores'
>;

export type MonsterTargetRef = {
  index: number;
  entity: Entity | null;
};

const normalizeName = (name: string | undefined) =>
  (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function createTurnContextFromGameState(state: GameState): TurnContext {
  const { session, character } = splitGameStateForSolo(state);
  return { session, actor: character };
}

export function composeGameStateFromTurnContext(context: TurnContext): GameState {
  return composeGameStateForSolo(context.session, context.actor);
}

export function syncTurnContextFromGameState(context: TurnContext, state: GameState): TurnContext {
  const { session, character } = splitGameStateForSoloTrusted(state);
  context.session = session;
  context.actor = character;
  return context;
}

export function getActorSheetFields(context: TurnContext): ActorSheetFields {
  return {
    character: { ...context.actor.character },
    skills: [...(context.actor.skills || [])],
    knownSpells: [...(context.actor.knownSpells || [])],
    preparedSpells: [...(context.actor.preparedSpells || [])],
    spellSlots: Object.fromEntries(
      Object.entries(context.actor.spellSlots || {}).map(([key, slot]) => [key, { ...slot }])
    ),
    inventory: (context.actor.inventory || []).map(item => ({ ...item })),
    equippedWeaponId: context.actor.equippedWeaponId,
    equippedArmorId: context.actor.equippedArmorId,
    abilityScores: { ...(context.actor.abilityScores || {}) },
  };
}

export function findActiveMonsterTarget(context: TurnContext, requestedTargetName?: string): MonsterTargetRef {
  const requestedTargetIndex = requestedTargetName
    ? context.session.nearbyEntities.findIndex(entity =>
        entity.status === 'alive' &&
        (normalizeName(entity.name).includes(normalizeName(requestedTargetName)) ||
          normalizeName(requestedTargetName).includes(normalizeName(entity.name)))
      )
    : -1;
  const activeIndex = requestedTargetIndex >= 0
    ? requestedTargetIndex
    : context.session.nearbyEntities.findIndex(entity => entity.status === 'alive');

  return {
    index: activeIndex,
    entity: activeIndex >= 0 ? context.session.nearbyEntities[activeIndex] : null,
  };
}

export function getMonsterTargetByIndex(context: TurnContext, targetIndex: number): MonsterTargetRef {
  return {
    index: targetIndex,
    entity: targetIndex >= 0 ? context.session.nearbyEntities[targetIndex] : null,
  };
}

export function applyDamageToMonsterTarget(
  context: TurnContext,
  targetIndex: number,
  damage: number
): { entity: Entity | null; status: 'hit' | 'kill' | null } {
  const target = targetIndex >= 0 ? context.session.nearbyEntities[targetIndex] : null;
  if (!target) return { entity: null, status: null };

  const updatedHp = Math.max(0, target.hp - damage);
  const updatedTarget: Entity = {
    ...target,
    hp: updatedHp,
    status: updatedHp <= 0 ? 'dead' : target.status,
  };

  context.session.nearbyEntities = context.session.nearbyEntities.map((entity, idx) =>
    idx === targetIndex ? updatedTarget : entity
  );

  return {
    entity: updatedTarget,
    status: updatedHp <= 0 ? 'kill' : 'hit',
  };
}

export function applyDamageToActor(context: TurnContext, damage: number): number {
  context.actor.hp = Math.max(0, context.actor.hp - damage);
  return context.actor.hp;
}

export function adjustActorGold(context: TurnContext, amount: number): number {
  if (!Number.isFinite(amount) || amount === 0) return context.actor.gold;
  context.actor.gold = Math.max(0, (context.actor.gold || 0) + amount);
  return context.actor.gold;
}

export function healActor(context: TurnContext, amount: number): number {
  context.actor.hp = Math.min(context.actor.maxHp, context.actor.hp + amount);
  return context.actor.hp;
}

export function consumeActorSpellSlot(context: TurnContext, slotKey: string): boolean {
  const slots = context.actor.spellSlots || {};
  const slot = slots[slotKey];
  if (!slot || slot.current <= 0) return false;
  context.actor.spellSlots = {
    ...slots,
    [slotKey]: { ...slot, current: slot.current - 1 },
  };
  return true;
}

export function setActorMinimumAc(context: TurnContext, minAc: number): number {
  context.actor.ac = Math.max(context.actor.ac, minAc);
  return context.actor.ac;
}

export function addActorEffect(
  context: TurnContext,
  effect: CharacterState['activeEffects'][number]
): CharacterState['activeEffects'] {
  context.actor.activeEffects = [...(context.actor.activeEffects || []), effect];
  return context.actor.activeEffects;
}

export function addMonsterEffect(
  context: TurnContext,
  targetIndex: number,
  effect: Entity['effects'][number]
): Entity | null {
  const target = targetIndex >= 0 ? context.session.nearbyEntities[targetIndex] : null;
  if (!target) return null;
  const updatedTarget = {
    ...target,
    effects: [...(target.effects || []), effect],
  };
  context.session.nearbyEntities = context.session.nearbyEntities.map((entity, idx) =>
    idx === targetIndex ? updatedTarget : entity
  );
  return updatedTarget;
}

export function removeActorInventoryItemByName(
  context: TurnContext,
  itemName: string
): CharacterState['inventory'] {
  context.actor.inventory = context.actor.inventory.filter(
    item => item.name.toLowerCase() !== itemName.toLowerCase()
  );
  return context.actor.inventory;
}

export function appendActorInventoryChange(
  context: TurnContext,
  entry: string,
  limit = 10
): CharacterState['inventoryChangeLog'] {
  context.actor.inventoryChangeLog = [...(context.actor.inventoryChangeLog || []), entry].slice(-limit);
  return context.actor.inventoryChangeLog;
}

export function addActorInventoryItem(
  context: TurnContext,
  item: CharacterState['inventory'][number]
): CharacterState['inventory'] {
  context.actor.inventory = [...(context.actor.inventory || []), item];
  return context.actor.inventory;
}

export function addOrStackActorInventoryItem(
  context: TurnContext,
  item: CharacterState['inventory'][number]
): CharacterState['inventory'] {
  const itemIndex = context.actor.inventory.findIndex(
    entry => entry.name.toLowerCase() === item.name.toLowerCase()
  );
  if (itemIndex < 0) {
    return addActorInventoryItem(context, item);
  }
  context.actor.inventory = context.actor.inventory.map((entry, idx) =>
    idx === itemIndex
      ? { ...entry, quantity: entry.quantity + item.quantity }
      : entry
  );
  return context.actor.inventory;
}

export function decrementActorInventoryItemAtIndex(
  context: TurnContext,
  itemIndex: number,
  amount = 1
): CharacterState['inventory'] {
  const item = context.actor.inventory[itemIndex];
  if (!item || amount <= 0) return context.actor.inventory;
  const remainingQty = Math.max(0, item.quantity - amount);
  context.actor.inventory = remainingQty > 0
    ? context.actor.inventory.map((entry, idx) =>
        idx === itemIndex ? { ...entry, quantity: remainingQty } : entry
      )
    : context.actor.inventory.filter((_, idx) => idx !== itemIndex);
  return context.actor.inventory;
}

export function addSessionStoryFlag(context: TurnContext, flag: string): SessionState['storyFlags'] {
  if (!context.session.storyFlags.includes(flag)) {
    context.session.storyFlags = [...context.session.storyFlags, flag];
  }
  return context.session.storyFlags;
}

export function incrementSessionSceneVisit(
  context: TurnContext,
  sceneGroup: string
): SessionState['sceneVisits'] {
  const visits = (context.session.sceneVisits || {})[sceneGroup] || 0;
  context.session.sceneVisits = {
    ...(context.session.sceneVisits || {}),
    [sceneGroup]: visits + 1,
  };
  return context.session.sceneVisits;
}

export function markSessionEntityLooted(
  context: TurnContext,
  entityIndex: number
): SessionState['nearbyEntities'] {
  const entity = context.session.nearbyEntities[entityIndex];
  if (!entity || entity.name.toLowerCase().includes('looted')) return context.session.nearbyEntities;
  context.session.nearbyEntities = context.session.nearbyEntities.map((entry, idx) =>
    idx === entityIndex ? { ...entry, name: `${entry.name} (looted)` } : entry
  );
  return context.session.nearbyEntities;
}
