import { getSceneById } from '../../story';
import {
  addActorInventoryItem,
  addSessionStoryFlag,
  appendActorInventoryChange,
  syncTurnContextFromGameState,
} from '../turn-context';
import { nextItemId } from './shared';
import type { TurnDraft } from './turn-draft';

/**
 * Section 6a: items a scene hides, found by searching, investigating, or a
 * scene-specific trigger phrase.
 *
 * Entirely data-driven from `story/*.json` (`StoryDiscovery`) — no item, quest
 * objective, or creature reaction is hardcoded here.
 */
export function resolveSceneDiscoveries(
  draft: TurnDraft,
  params: { userAction: string; wantsSearch: boolean; wantsInvestigate: boolean }
): { attemptedSearch: boolean; foundSearchItems: boolean } {
  const { state, context } = draft;
  const { userAction, wantsSearch, wantsInvestigate } = params;

  const discoveries = getSceneById(state.storySceneId)?.discovery || [];
  const triggered = discoveries.filter(disc =>
    wantsSearch
    || wantsInvestigate
    || (disc.triggerPattern ? new RegExp(disc.triggerPattern, 'i').test(userAction) : false)
  );
  if (triggered.length === 0) return { attemptedSearch: false, foundSearchItems: false };

  syncTurnContextFromGameState(context, state);
  let foundSearchItems = false;

  for (const disc of triggered) {
    const alreadyFound = state.storyFlags.includes(disc.onceFlag)
      || state.inventory.some(item => item.name.toLowerCase() === disc.item.toLowerCase());
    if (alreadyFound) continue;
    if (Math.random() >= (disc.chance ?? 1)) continue;

    const itemType = disc.itemType || (/key|sigil|map/i.test(disc.item) ? 'key' as const : 'misc' as const);
    state.inventory = addActorInventoryItem(context, {
      id: nextItemId('disc'),
      name: disc.item,
      type: itemType,
      quantity: 1,
      equipped: false,
    });
    state.storyFlags = addSessionStoryFlag(context, disc.onceFlag);
    state.inventoryChangeLog = appendActorInventoryChange(context, `Found ${disc.item} at ${state.location}`);
    draft.summary.push(disc.log || `Your search turns up ${disc.item}.`);
    foundSearchItems = true;

    if (disc.completesObjective) {
      state.quests = state.quests.map(quest => {
        const objectives = (quest.objectives || []).map(obj =>
          obj.id === disc.completesObjective ? { ...obj, done: true } : obj
        );
        if (!objectives.some(obj => obj.id === disc.completesObjective)) return quest;
        const allDone = objectives.length > 0 && objectives.every(obj => obj.done);
        const objectiveTitle = objectives.find(obj => obj.id === disc.completesObjective)?.text || disc.item;
        draft.summary.push(`Quest updated: ${quest.title} — ${objectiveTitle} ✓`);
        return { ...quest, objectives, status: allDone ? 'completed' : quest.status };
      });
    }

    if (disc.pacifies?.length) {
      state.nearbyEntities = state.nearbyEntities.map(entity =>
        disc.pacifies!.some(fragment => entity.name.toLowerCase().includes(fragment.toLowerCase()))
          ? { ...entity, status: entity.status === 'alive' ? 'fleeing' : entity.status }
          : entity
      );
      state.isCombatActive = state.nearbyEntities.some(e => e.status === 'alive' && e.hp > 0) && state.hp > 0;
    }
  }

  return { attemptedSearch: true, foundSearchItems };
}
