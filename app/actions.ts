'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { savedGames } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { buildNewGameState, hydrateState } from '../lib/game/state';
import { parseIntent } from '../lib/game/intent';
import { runGameTurn } from '../lib/game/engine';
import { isValidSessionCode, normalizeSessionCodeInput } from '../lib/game/session-code';
import type { GameState, LogEntry } from '../lib/game-schema';
import type { ArchetypeKey } from './characters';
import {
  createCharacterStateForJoiner,
  createMultiplayerSession,
  joinMultiplayerSession,
  loadMultiplayerSession,
  processMultiplayerSessionTurn,
  type MultiplayerSessionSnapshot,
  type SessionTurnResult,
} from '../lib/game/session-service';

type CreateOptions = { archetypeKey?: ArchetypeKey; forceNew?: boolean };

async function getUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('You must be logged in.');
  return userId;
}

type SavedGame = {
  state: GameState;
  version: number;
};

async function loadSave(userId: string): Promise<SavedGame | null> {
  const [row] = await db.select().from(savedGames).where(eq(savedGames.userId, userId)).limit(1);
  if (!row) return null;
  // Always validate and migrate the JSONB through Zod before returning
  return { state: await hydrateState(row.gameState), version: row.version };
}

async function createSave(userId: string, state: GameState): Promise<boolean> {
  const inserted = await db
    .insert(savedGames)
    .values({
      userId,
      gameState: state as unknown as Record<string, unknown>,
      version: 0,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ userId: savedGames.userId });
  return inserted.length === 1;
}

async function persistSave(userId: string, state: GameState, expectedVersion: number): Promise<void> {
  const updated = await db
    .update(savedGames)
    .set({
      gameState: state as unknown as Record<string, unknown>,
      version: expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(savedGames.userId, userId), eq(savedGames.version, expectedVersion)))
    .returning({ userId: savedGames.userId });
  if (updated.length !== 1) {
    throw new Error('Your save changed in another tab. Reload and try again.');
  }
}

export type SavedGameSummary = {
  name: string;
  className: string;
  level: number;
};

// Lets the character-select screen distinguish "continue your run" from
// "start a new run" instead of silently ignoring the picked class.
export async function getSavedGameSummary(): Promise<SavedGameSummary | null> {
  const userId = await getUserId();
  const save = await loadSave(userId);
  if (!save) return null;
  return {
    name: save.state.character?.name || 'Adventurer',
    className: save.state.character?.class || 'Fighter',
    level: save.state.level || 1,
  };
}

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const userId = await getUserId();
  const forceNew = opts?.forceNew ?? false;

  if (!forceNew) {
    const existing = await loadSave(userId);
    if (existing) {
      return existing.state;
    }
  }

  const newState = await buildNewGameState(opts?.archetypeKey);
  const existing = await loadSave(userId);
  if (existing) {
    await persistSave(userId, newState, existing.version);
  } else if (!(await createSave(userId, newState))) {
    throw new Error('A save was created in another tab. Reload and try again.');
  }
  return newState;
}

// currentState is intentionally NOT accepted from the client — we load from DB
// to prevent client-side tampering with hp, gold, inventory, etc.
export async function processTurn(
  userAction: string
): Promise<{ newState: GameState; logEntry: LogEntry }> {
  if (typeof userAction !== 'string' || userAction.length > 1000) {
    throw new Error('Invalid action.');
  }
  const sanitized = userAction.trim().slice(0, 500);

  const userId = await getUserId();
  const save = await loadSave(userId);
  if (!save) throw new Error('No active game found. Start a new game first.');

  const intent = parseIntent(sanitized, save.state);
  const { newState, logEntry } = await runGameTurn(save.state, intent);
  await persistSave(userId, newState, save.version);
  return { newState, logEntry };
}

export async function resetGame(archetypeKey?: ArchetypeKey) {
  return createNewGame({ forceNew: true, archetypeKey });
}

export async function createMultiplayerFromCurrentGame(): Promise<MultiplayerSessionSnapshot> {
  const userId = await getUserId();
  const save = await loadSave(userId);
  if (!save) throw new Error('No active game found. Start a new game first.');
  return createMultiplayerSession(db, userId, save.state);
}

export async function joinMultiplayerByCode(
  code: string,
  archetypeKey?: ArchetypeKey
): Promise<MultiplayerSessionSnapshot> {
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('Enter a session code.');
  }
  const normalizedCode = normalizeSessionCodeInput(code);
  if (!isValidSessionCode(normalizedCode)) {
    throw new Error('Party codes are exactly 6 characters.');
  }
  const userId = await getUserId();
  const newState = await buildNewGameState(archetypeKey);
  const character = createCharacterStateForJoiner(newState, userId);
  return joinMultiplayerSession(db, normalizedCode, userId, character);
}

export async function loadCurrentMultiplayerSession(code: string): Promise<MultiplayerSessionSnapshot | null> {
  if (typeof code !== 'string' || !code.trim()) return null;
  const normalizedCode = normalizeSessionCodeInput(code);
  if (!isValidSessionCode(normalizedCode)) return null;
  const userId = await getUserId();
  return loadMultiplayerSession(db, normalizedCode, userId);
}

export async function processMultiplayerTurn(
  code: string,
  userAction: string
): Promise<SessionTurnResult> {
  if (typeof userAction !== 'string' || userAction.length > 1000) {
    throw new Error('Invalid action.');
  }
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('Invalid session code.');
  }
  const normalizedCode = normalizeSessionCodeInput(code);
  if (!isValidSessionCode(normalizedCode)) {
    throw new Error('Invalid session code.');
  }
  const userId = await getUserId();
  const sanitized = userAction.trim().slice(0, 500);
  return processMultiplayerSessionTurn(db, normalizedCode, userId, sanitized);
}
