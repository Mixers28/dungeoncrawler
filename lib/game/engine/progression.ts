import type { GameState, TurnEvent } from '../../game-schema';
import { rollLoot } from '../../loot';
import { getNextLevelDef } from '../../progression';
import { MONSTER_MANUAL, STORY_ACTS } from '../../rules';
import type { StoryScene } from '../../story';
import { getSceneById } from '../../story';
import { nextItemId } from './shared';
import type { TurnDraft } from './turn-draft';

function awardGold(state: GameState, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return;
  state.gold = Math.max(0, (state.gold || 0) + amount);
}

export function applyXpAndCheckLevelUp(state: GameState, xpGained: number, logs: string[], reason?: string) {
  if (!Number.isFinite(xpGained) || xpGained <= 0) return;
  state.xp += xpGained;
  if (reason) {
    logs.push(`You gain ${xpGained} XP ${reason}`);
  } else {
    logs.push(`You gain ${xpGained} XP.`);
  }

  while (true) {
    const next = getNextLevelDef(state.level);
    if (!next) break;
    if (state.xp < next.xpRequired) break;
    state.level = next.level;
    state.maxHp += next.hpGain;
    state.hp = state.maxHp;
    logs.push(`You reach level ${state.level}. Your maximum HP increases to ${state.maxHp}.`);
  }
  const upcoming = getNextLevelDef(state.level);
  if (upcoming) state.xpToNext = upcoming.xpRequired;
}

// Mark flag-gated quest objectives done when their story flag is set, completing quests
// whose objectives are all done. Generic so new flag-driven quests need no bespoke code.
export function reconcileFlagQuests(state: GameState, logs: string[]) {
  const flags = state.storyFlags || [];
  state.quests = (state.quests || []).map(quest => {
    let changed = false;
    const objectives = (quest.objectives || []).map(obj => {
      if (obj.flag && !obj.done && flags.includes(obj.flag)) {
        changed = true;
        return { ...obj, done: true };
      }
      return obj;
    });
    const allDone = objectives.length > 0 && objectives.every(o => o.done);
    const status = allDone && quest.status === 'active' ? 'completed' as const : quest.status;
    if (changed) {
      logs.push(`Quest updated: ${quest.title}${allDone ? ' — complete!' : ''}`);
    }
    return { ...quest, objectives, status };
  });
}

// Applies a scene's onComplete flags/rewards exactly once (guarded by flagsSet).
// Called both at end-of-turn for the current scene and when exiting a cleared
// scene, so leaving immediately after a fight still counts as completing it.
export function applySceneCompletion(state: GameState, scene: StoryScene, summaryParts: string[], turnEvents?: TurnEvent[]) {
  if (!scene.onComplete?.flagsSet) return;
  const newFlags = scene.onComplete.flagsSet.filter(f => !(state.storyFlags || []).includes(f));
  if (newFlags.length === 0) return;
  state.storyFlags = [...(state.storyFlags || []), ...newFlags];
  const rewardXp = scene.onComplete.reward?.xp || 0;
  if (rewardXp > 0) {
    applyXpAndCheckLevelUp(
      state,
      rewardXp,
      summaryParts,
      `for securing ${scene.title || scene.location}.`
    );
  }
  const rewardItems = scene.onComplete.reward?.items || [];
  const grantedItems = rewardItems.filter(name =>
    !state.inventory.some(i => i.name.toLowerCase() === name.toLowerCase())
  );
  if (grantedItems.length > 0) {
    state.inventory = [
      ...state.inventory,
      ...grantedItems.map((name, idx) => ({
        id: `reward-${Date.now().toString(36)}-${idx}`,
        name,
        type: (/key|sigil|map/i.test(name) ? 'key' : 'misc') as 'key' | 'misc',
        quantity: 1,
        equipped: false,
      })),
    ];
    state.inventoryChangeLog = [...state.inventoryChangeLog, `Scene reward: ${grantedItems.join(', ')}`].slice(-10);
    summaryParts.push(`You claim ${grantedItems.join(' and ')}.`);
    turnEvents?.push({
      type: 'loot',
      targetName: scene.title || scene.location,
      items: grantedItems.map(name => ({ name, quantity: 1 })),
    });
  }
  const lootTable = scene.onComplete.reward?.lootTable;
  if (lootTable) {
    const loot = rollLoot(lootTable);
    if (loot) {
      const coinGain = Object.entries(loot.coins).filter(([, v]) => (v || 0) > 0);
      if (coinGain.length > 0) {
        const gold = loot.coins.gp || 0;
        const silver = loot.coins.sp || 0;
        const copper = loot.coins.cp || 0;
        if (gold > 0) {
          awardGold(state, gold);
          turnEvents?.push({ type: 'coins', targetName: scene.title || scene.location, amount: gold });
        }
        const coinParts = [
          gold > 0 ? `${gold} gp` : null,
          silver > 0 ? `${silver} sp` : null,
          copper > 0 ? `${copper} cp` : null,
        ].filter(Boolean);
        summaryParts.push(`You recover ${coinParts.join(', ')}.`);
      }
      if (loot.items.length > 0) {
        const newItems = loot.items.map(it => ({
          id: nextItemId('loot'),
          name: it.id.replace(/_/g, ' '),
          type: 'misc' as const,
          quantity: it.quantity,
          equipped: false,
        }));
        state.inventory = [...state.inventory, ...newItems];
        state.inventoryChangeLog = [...state.inventoryChangeLog, `Scene loot: ${newItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`].slice(-10);
        summaryParts.push(`Loot found: ${newItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}.`);
        turnEvents?.push({
          type: 'loot',
          targetName: scene.title || scene.location,
          items: newItems.map(i => ({ name: i.name, quantity: i.quantity })),
        });
      }
    }
  }
}

/**
 * Section 7: kills, XP, story-act advancement, and scene completion rewards.
 *
 * `monsterKilled` is decided by the caller, which owns the before/after view of
 * the active monster.
 */
export function resolveProgression(
  draft: TurnDraft,
  params: { monsterKilled: boolean; activeMonsterName?: string }
): void {
  const { state } = draft;
  const { monsterKilled, activeMonsterName } = params;

  if (monsterKilled && activeMonsterName) {
    state.totalKills = (state.totalKills || 0) + 1;
    const xpAward = MONSTER_MANUAL[activeMonsterName]?.hp
      ? Math.max(25, MONSTER_MANUAL[activeMonsterName].hp * 5)
      : 50;
    applyXpAndCheckLevelUp(state, xpAward, draft.summary);
  }

  // Advance story act based on key item possession and boss kills
  const maxAct = Math.max(...Object.keys(STORY_ACTS).map(Number));
  if (state.storyAct === 0 && state.inventory.some(i => i.name === 'Iron Key')) {
    state.storyAct = 1;
    draft.summary.push("You hold the Iron Key. The inner sanctum's gate can be breached.");
  }
  if (state.storyAct === 1 && state.inventory.some(i => i.name === 'Cursed Crown')) {
    state.storyAct = 2;
    draft.summary.push("The Cursed Crown is yours. One foe remains — face the Iron King.");
  }
  if (state.storyAct >= 2 && monsterKilled && activeMonsterName === 'Iron King') {
    state.storyFlags = [...(state.storyFlags || []), 'iron_king_defeated'];
    draft.summary.push("The Iron King falls. The curse shatters. Aethelgard breathes again.");
  }
  state.storyAct = Math.min(maxAct, Math.max(0, state.storyAct));

  // Scene completion rewards
  const sceneForReward = getSceneById(state.storySceneId);
  const sceneCleared = !state.nearbyEntities.some(e => e.status === 'alive');
  if (sceneForReward && sceneCleared) {
    applySceneCompletion(state, sceneForReward, draft.summary, draft.events);
  }

  // Reconcile flag-gated quest objectives now that all story flags for this turn are set.
  reconcileFlagQuests(state, draft.summary);
}
