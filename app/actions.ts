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
  if (!row) return null;
  // Always validate and migrate the JSONB through Zod before returning
  return hydrateState(row.gameState);
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
      await persistSave(userId, existing);
      return existing;
    }
  }

  const newState = await buildNewGameState(opts?.archetypeKey);
  await persistSave(userId, newState);
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
  const currentState = await loadSave(userId);
  if (!currentState) throw new Error('No active game found. Start a new game first.');

  const intent = parseIntent(sanitized, currentState);
  const { newState, logEntry } = await runGameTurn(currentState, intent);
  await persistSave(userId, newState);
  return { newState, logEntry };
}

export async function resetGame(archetypeKey?: ArchetypeKey) {
  return createNewGame({ forceNew: true, archetypeKey });
}
