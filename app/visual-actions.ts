'use server';

import { buildVisualGameViewModel, type VisualGameViewModel } from '../lib/visual/view-model';
import type { GameState } from '../lib/game-schema';

export async function getVisualViewModel(state: GameState): Promise<VisualGameViewModel> {
  return buildVisualGameViewModel(state);
}
