'use server';

import {
  buildMultiplayerVisualGameViewModel,
  buildVisualGameViewModel,
  type MultiplayerVisualPlayer,
  type VisualGameViewModel,
} from '../lib/visual/view-model';
import type { CharacterState, GameState, SessionState } from '../lib/game-schema';

export async function getVisualViewModel(state: GameState): Promise<VisualGameViewModel> {
  return buildVisualGameViewModel(state);
}

export async function getMultiplayerVisualViewModel(params: {
  session: SessionState;
  you: CharacterState;
  players: MultiplayerVisualPlayer[];
}): Promise<VisualGameViewModel> {
  return buildMultiplayerVisualGameViewModel(params);
}
