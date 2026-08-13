import type { StoryExit, StoryScene } from '../../story';

// Scene exits and location/biome keys.
export function normalizeLocationKey(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim() || 'unknown';
}

export function resolveBiomeKey(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes('crypt')) return 'crypt';
  if (lower.includes('sewer') || lower.includes('sewers')) return 'sewers';
  if (lower.includes('courtyard') || lower.includes('gate') || lower.includes('citadel')) return 'fortress';
  if (lower.includes('throne') || lower.includes('catacomb')) return 'catacombs';
  return 'default';
}

export function findSceneExitForAction(currentScene: StoryScene | null, userAction: string): StoryExit | undefined {
  const exits = currentScene?.exits || [];
  const lowerAction = userAction.toLowerCase();
  const explicitExit = exits.find(ex => ex.verb.some(v => lowerAction.includes(v.toLowerCase())));
  if (explicitExit) return explicitExit;

  if (!/\binteract\b/i.test(userAction)) return undefined;

  const interactionExits = exits.filter(exit => {
    const verbs = exit.verb.map(verb => verb.toLowerCase());
    const isBacktrack = verbs.some(verb => ['back', 'return', 'leave', 'exit'].includes(verb));
    const isInteraction = !!exit.consumeItem || verbs.some(verb =>
      ['open', 'push', 'pull', 'use', 'activate', 'unlock', 'turn', 'door', 'gate', 'lever', 'altar', 'cache', 'armory', 'sanctum'].includes(verb)
    );
    return isInteraction && !isBacktrack;
  });

  if (interactionExits.length === 1) return interactionExits[0];
  if (exits.length === 1) return exits[0];
  return undefined;
}
