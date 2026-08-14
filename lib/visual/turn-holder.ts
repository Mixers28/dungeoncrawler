import type { CharacterState } from '../game-schema';

// Kept in its own leaf module because both the client page and the view model
// need it: importing it from view-model.ts would pull the story loader (and its
// `fs` import) into the client bundle.
export function resolveTurnHolderName(
  players: { character: CharacterState }[],
  playerId: string | null | undefined
): string {
  if (!playerId) return 'the party';
  const holder = players.find(player => player.character.playerId === playerId);
  return holder?.character.character?.name || 'another adventurer';
}
