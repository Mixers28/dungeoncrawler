'use server';

import { buildNewGameState, hydrateState, type GameState, type LogEntry } from '../lib/game/state';
import { parseIntent } from '../lib/game/intent';
import { runGameTurn } from '../lib/game/engine';
import type { ArchetypeKey } from './characters';

type CreateOptions = { archetypeKey?: ArchetypeKey; forceNew?: boolean; existingSave?: GameState };

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const archetypeKey = opts?.archetypeKey;
  const forceNew = opts?.forceNew ?? false;
  const existingSave = opts?.existingSave;

  // If we have an existing save and not forcing new, hydrate and return it
  if (existingSave && !forceNew) {
    const hydrated = await hydrateState(existingSave);
    return hydrated;
  }

  // Create new game
  const seededState = await buildNewGameState(archetypeKey);
  return seededState;
}

export async function processTurn(
  currentState: GameState,
  userAction: string
): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const intent = parseIntent(userAction, currentState);
  const { newState, logEntry } = await runGameTurn(currentState, intent);

  return { newState, logEntry };
}

export async function resetGame(archetypeKey?: ArchetypeKey) {
  return createNewGame({ forceNew: true, archetypeKey });
}
