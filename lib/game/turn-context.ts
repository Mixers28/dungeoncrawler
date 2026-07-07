import type { Entity } from '../game-schema';
import { type CharacterState, type GameState, type SessionState } from '../game-schema';
import { composeGameStateForSolo, splitGameStateForSolo } from './state-split';

export type TurnContext = {
  session: SessionState;
  actor: CharacterState;
};

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
  const { session, character } = splitGameStateForSolo(state);
  context.session = session;
  context.actor = character;
  return context;
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
