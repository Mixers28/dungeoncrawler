'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { savedGames } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildNewGameState, hydrateState } from '../lib/game/state';
import { parseIntent } from '../lib/game/intent';
import { runGameTurn } from '../lib/game/engine';
import type { GameState, LogEntry } from '../lib/game-schema';
import type { ArchetypeKey } from './characters';

type CreateOptions = { archetypeKey?: ArchetypeKey; forceNew?: boolean };

async function getUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('You must be logged in.');
  return userId;
}

async function loadSave(userId: string): Promise<GameState | null> {
  const [row] = await db.select().from(savedGames).where(eq(savedGames.userId, userId)).limit(1);
  return row ? (row.gameState as unknown as GameState) : null;
}

async function persistSave(userId: string, state: GameState): Promise<void> {
  await db
    .insert(savedGames)
    .values({ userId, gameState: state as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: savedGames.userId,
      set: { gameState: state as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
}

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const userId = await getUserId();
  const forceNew = opts?.forceNew ?? false;

  if (!forceNew) {
    const existing = await loadSave(userId);
    if (existing) {
      const hydrated = await hydrateState(existing);
      await persistSave(userId, hydrated);
      return hydrated;
    }
  }

  const newState = await buildNewGameState(opts?.archetypeKey);
  await persistSave(userId, newState);
  return newState;
}

export async function processTurn(
  currentState: GameState,
  userAction: string
): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const userId = await getUserId();
  const intent = parseIntent(userAction, currentState);
  const { newState, logEntry } = await runGameTurn(currentState, intent);
  await persistSave(userId, newState);
  return { newState, logEntry };
}

export async function resetGame(archetypeKey?: ArchetypeKey) {
  return createNewGame({ forceNew: true, archetypeKey });
}
