'use server';

import { createClient } from '../utils/supabase/server';
import { buildNewGameState, hydrateState, type GameState, type LogEntry } from '../lib/game/state';
import { parseIntent } from '../lib/game/intent';
import { runGameTurn } from '../lib/game/engine';
import type { ArchetypeKey } from './characters';

type CreateOptions = { archetypeKey?: ArchetypeKey; forceNew?: boolean };

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in.');

  const archetypeKey = opts?.archetypeKey;
  const forceNew = opts?.forceNew ?? false;

  const { data: existingSave } = await supabase
    .from('saved_games')
    .select('game_state')
    .eq('user_id', user.id)
    .single();

  if (existingSave?.game_state && !forceNew) {
    const hydrated = await hydrateState(existingSave.game_state);
    const { error: updateError } = await supabase
      .from('saved_games')
      .upsert({ user_id: user.id, game_state: hydrated }, { onConflict: 'user_id' });
    if (updateError) console.error('Failed to update existing save:', updateError);
    return hydrated;
  }

  const seededState = await buildNewGameState(archetypeKey);
  const { error: saveError } = await supabase
    .from('saved_games')
    .upsert({ user_id: user.id, game_state: seededState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save new game: ${saveError.message}`);
  return seededState;
}

export async function processTurn(
  currentState: GameState,
  userAction: string
): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const intent = parseIntent(userAction, currentState);
  const { newState, logEntry } = await runGameTurn(currentState, intent);

  const { error: saveError } = await supabase
    .from('saved_games')
    .upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save turn: ${saveError.message}`);

  return { newState, logEntry };
}

export async function resetGame(archetypeKey?: ArchetypeKey) {
  return createNewGame({ forceNew: true, archetypeKey });
}
