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
