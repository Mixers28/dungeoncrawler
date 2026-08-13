import type { GameState } from '../../game-schema';

// Small helpers shared by the engine's section modules. Kept here (rather than
// in index.ts) so the sections can import them without a cycle back through the
// module that composes them.

// Ids must stay distinct even when several items are created inside one
// millisecond and when Math.random is stubbed (the regression suite pins it to
// a constant), so uniqueness comes from a counter rather than from entropy.
let itemIdSequence = 0;

export const nextItemId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(itemIdSequence++).toString(36)}`;

export const normalizeSpellName = (name: string | undefined) =>
  (name || '').toLowerCase().replace(/[_-]+/g, ' ').trim();

export const normalizeName = (name: string | undefined) =>
  (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function pushStoryFlag(state: GameState, flag: string) {
  if (!flag) return;
  const flags = state.storyFlags || [];
  if (!flags.includes(flag)) {
    state.storyFlags = [...flags, flag];
  }
}
