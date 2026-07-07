import type { GameState, LogEntry } from '../game-schema';
import { isConsumableItem } from '../consumables';
import { getSceneById, pickSceneVariant, type StoryExit, type StoryScene } from '../story';
import {
  normalizeVisualAssetId,
  resolveVisualAsset,
  type VisualAsset,
} from './assets';

export type VisualActionKind = 'movement' | 'exploration' | 'combat' | 'inventory' | 'spell' | 'system';
export type VisualDirection = 'forward' | 'back' | 'left' | 'right' | 'north' | 'east' | 'south' | 'west' | 'unknown';

export type VisualAction = {
  id: string;
  kind: VisualActionKind;
  label: string;
  command: string;
  enabled: boolean;
  reason?: string;
  direction?: VisualDirection;
  targetId?: string;
  imagePath?: string;
  imageAssetId?: string;
};

export type VisualPartySlot = {
  playerId: string;
  displayName: string;
  className: string;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  isYou: boolean;
  isActiveTurn: boolean;
  portraitAssetId?: string;
  portraitPath?: string;
};

export type VisualTurnState = {
  mode: 'solo' | 'exploration' | 'combat';
  currentTurnPlayerId: string | null;
  canAct: boolean;
  reason?: string;
};

export type VisualSceneView = {
  sceneId: string;
  location: string;
  title?: string;
  description: string;
  imagePath: string;
  imageAssetId?: string;
};

export type VisualThreatView = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  status: string;
  isAlive: boolean;
  imagePath: string;
  imageAssetId?: string;
  attackAction?: VisualAction;
};

export type VisualLogEntry = {
  id: string;
  summary: string;
  flavor?: string;
  mode: LogEntry['mode'];
  createdAt: string;
  actorName?: string;
};

export type VisualGameViewModel = {
  mode: 'solo';
  scene: VisualSceneView;
  partySlots: VisualPartySlot[];
  turnState: VisualTurnState;
  movementActions: VisualAction[];
  explorationActions: VisualAction[];
  combatActions: VisualAction[];
  inventoryActions: VisualAction[];
  spellActions: VisualAction[];
  threats: VisualThreatView[];
  logEntries: VisualLogEntry[];
  canUseTextFallback: boolean;
};

const SOLO_PLAYER_ID = 'solo';
const FALLBACK_SCENE_PATH = '/prologue/gate.png';
const FALLBACK_ASSET_PATH = '/file.svg';

function hasInventoryItem(state: GameState, name: string): boolean {
  return state.inventory.some(item => item.name.toLowerCase() === name.toLowerCase());
}

function hasAllFlags(flags: string[], required: string[] | undefined): boolean {
  return !required || required.every(flag => flags.includes(flag));
}

function hasAnyFlag(flags: string[], required: string[] | undefined): boolean {
  return !required || required.length === 0 || required.some(flag => flags.includes(flag));
}

function groupHash(group: string): number {
  return group.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function resolveExitTarget(exit: StoryExit, worldSeed: number): StoryScene | null {
  let target = getSceneById(exit.targetSceneId);
  if (target?.group) {
    target = pickSceneVariant(target.group, worldSeed + groupHash(target.group)) || target;
  }
  return target;
}

function effectiveStoryFlags(state: GameState, currentScene: StoryScene | null, aliveThreat: boolean): string[] {
  const flags = [...(state.storyFlags || [])];
  if (aliveThreat || !currentScene?.onComplete?.flagsSet) return flags;
  for (const flag of currentScene.onComplete.flagsSet) {
    if (!flags.includes(flag)) flags.push(flag);
  }
  return flags;
}

function movementLockedReason(
  state: GameState,
  currentScene: StoryScene | null,
  exit: StoryExit,
  target: StoryScene | null,
  aliveThreat: boolean
): string | undefined {
  if (aliveThreat) return 'Threats must be cleared before moving.';
  if (!target) return 'No mapped destination.';
  if (exit.consumeItem && !hasInventoryItem(state, exit.consumeItem)) {
    return `Requires ${exit.consumeItem}.`;
  }

  const conditions = target.entryConditions;
  if (!conditions) return undefined;

  const flags = effectiveStoryFlags(state, currentScene, aliveThreat);
  if (conditions.minLevel && state.level < conditions.minLevel) {
    return `Requires level ${conditions.minLevel}.`;
  }
  if (conditions.requiresItem && !hasInventoryItem(state, conditions.requiresItem)) {
    return `Requires ${conditions.requiresItem}.`;
  }
  if (!hasAllFlags(flags, conditions.flagsAll)) {
    return 'Requires more progress.';
  }
  if (!hasAnyFlag(flags, conditions.flagsAny)) {
    return 'Requires more progress.';
  }
  return undefined;
}

function inferDirection(verbs: string[]): VisualDirection {
  const lower = verbs.map(verb => verb.toLowerCase());
  if (lower.some(verb => ['north', 'forward', 'enter', 'proceed', 'open', 'deeper'].includes(verb))) return 'forward';
  if (lower.some(verb => ['back', 'south', 'up', 'leave', 'exit'].includes(verb))) return 'back';
  if (lower.includes('west')) return 'left';
  if (lower.includes('east')) return 'right';
  if (lower.includes('north')) return 'north';
  if (lower.includes('south')) return 'south';
  return 'unknown';
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function labelForExit(exit: StoryExit, target: StoryScene | null): string {
  if (target?.title) return target.title;
  if (target?.location) return target.location;
  return titleCase(exit.verb[0] || 'Move');
}

function buildMovementActions(state: GameState, currentScene: StoryScene | null, aliveThreat: boolean): VisualAction[] {
  return (currentScene?.exits || []).map((exit, idx) => {
    const target = resolveExitTarget(exit, state.worldSeed || 0);
    const reason = movementLockedReason(state, currentScene, exit, target, aliveThreat);
    const command = exit.verb[0] || 'look around';
    return {
      id: `move-${currentScene?.id || state.storySceneId}-${idx}`,
      kind: 'movement',
      label: labelForExit(exit, target),
      command,
      enabled: !reason,
      reason,
      direction: inferDirection(exit.verb),
      targetId: target?.id || exit.targetSceneId,
    };
  });
}

function buildExplorationActions(canAct: boolean, aliveThreat: boolean): VisualAction[] {
  const blockedReason = canAct ? undefined : 'You cannot act right now.';
  return [
    {
      id: 'look',
      kind: 'exploration',
      label: 'Look',
      command: 'look around',
      enabled: canAct,
      reason: blockedReason,
    },
    {
      id: 'search',
      kind: 'exploration',
      label: 'Search',
      command: 'search',
      enabled: canAct && !aliveThreat,
      reason: aliveThreat ? 'Clear threats before searching.' : blockedReason,
    },
    {
      id: 'interact',
      kind: 'exploration',
      label: 'Interact',
      command: 'interact',
      enabled: canAct && !aliveThreat,
      reason: aliveThreat ? 'Clear threats before interacting.' : blockedReason,
    },
  ];
}

function buildCombatActions(canAct: boolean, aliveThreat: boolean): VisualAction[] {
  const reason = canAct ? undefined : 'You cannot act right now.';
  return [
    {
      id: 'attack',
      kind: 'combat',
      label: 'Attack',
      command: 'attack',
      enabled: canAct && aliveThreat,
      reason: aliveThreat ? reason : 'No active target.',
    },
    {
      id: 'defend',
      kind: 'combat',
      label: 'Defend',
      command: 'defend',
      enabled: canAct && aliveThreat,
      reason: aliveThreat ? reason : 'No active threat.',
    },
    {
      id: 'flee',
      kind: 'combat',
      label: 'Flee',
      command: 'run away',
      enabled: canAct && aliveThreat,
      reason: aliveThreat ? reason : 'No active threat.',
    },
  ];
}

function buildInventoryActions(state: GameState, canAct: boolean): VisualAction[] {
  return state.inventory
    .filter(item => isConsumableItem(item))
    .map(item => {
      const asset = resolveVisualAsset('item', [item.id, item.name], 'fallback_item');
      return {
        id: `item-${normalizeVisualAssetId(item.id || item.name)}`,
        kind: 'inventory' as const,
        label: item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name,
        command: `use ${item.name.toLowerCase()}`,
        enabled: canAct && item.quantity > 0,
        reason: canAct ? undefined : 'You cannot act right now.',
        targetId: item.id,
        imagePath: asset?.path,
        imageAssetId: asset?.id,
      };
    });
}

function buildSpellActions(state: GameState, canAct: boolean): VisualAction[] {
  const prepared = new Set((state.preparedSpells || []).map(spell => spell.toLowerCase()));
  const spells = state.preparedSpells?.length ? state.preparedSpells : state.knownSpells || [];
  return spells.map(spell => ({
    id: `spell-${normalizeVisualAssetId(spell)}`,
    kind: 'spell' as const,
    label: spell,
    command: `cast ${spell.toLowerCase()}`,
    enabled: canAct && (prepared.size === 0 || prepared.has(spell.toLowerCase())),
    reason: canAct ? undefined : 'You cannot act right now.',
  }));
}

function resolveSceneImage(state: GameState, scene: StoryScene | null): { path: string; asset?: VisualAsset } {
  const asset = resolveVisualAsset('scene', [state.storySceneId, scene?.group, state.location], 'fallback_scene');
  if (asset && asset.id !== 'fallback_scene') return { path: asset.path, asset };
  return { path: state.currentImage || asset?.path || FALLBACK_SCENE_PATH, asset: asset || undefined };
}

function resolvePortrait(state: GameState): { path?: string; asset?: VisualAsset } {
  const asset = resolveVisualAsset('portrait', [
    state.character?.archetypeKey,
    state.character?.class,
  ]);
  return { path: asset?.path, asset: asset || undefined };
}

function resolveThreatImage(name: string, fallbackImageUrl?: string): { path: string; asset?: VisualAsset } {
  const asset = resolveVisualAsset('monster', [name], 'fallback_monster');
  if (asset) return { path: asset.path, asset };
  return { path: fallbackImageUrl || FALLBACK_ASSET_PATH };
}

function buildPartySlot(state: GameState, turnState: VisualTurnState): VisualPartySlot {
  const portrait = resolvePortrait(state);
  return {
    playerId: SOLO_PLAYER_ID,
    displayName: state.character?.name || 'Adventurer',
    className: state.character?.class || 'Adventurer',
    hp: state.hp,
    maxHp: state.maxHp,
    ac: state.ac,
    conditions: (state.activeEffects || []).map(effect => effect.name),
    isYou: true,
    isActiveTurn: turnState.currentTurnPlayerId === SOLO_PLAYER_ID,
    portraitAssetId: portrait.asset?.id,
    portraitPath: portrait.path,
  };
}

function commandTargetName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildThreatAttackAction(entityName: string, idx: number, canAct: boolean, isAlive: boolean): VisualAction {
  const targetName = commandTargetName(entityName);
  const enabled = canAct && isAlive;
  return {
    id: `attack-threat-${idx}-${normalizeVisualAssetId(entityName)}`,
    kind: 'combat',
    label: `Attack ${entityName}`,
    command: targetName ? `attack ${targetName}` : 'attack',
    enabled,
    reason: enabled ? undefined : canAct ? 'Target is not active.' : 'You cannot act right now.',
    targetId: `threat-${idx}-${normalizeVisualAssetId(entityName)}`,
  };
}

function buildThreatViews(state: GameState, canAct: boolean): VisualThreatView[] {
  return (state.nearbyEntities || []).map((entity, idx) => {
    const image = resolveThreatImage(entity.name, entity.imageUrl);
    const id = `threat-${idx}-${normalizeVisualAssetId(entity.name)}`;
    const isAlive = entity.status === 'alive' && entity.hp > 0;
    return {
      id,
      name: entity.name,
      hp: entity.hp,
      maxHp: entity.maxHp,
      ac: entity.ac,
      status: entity.status,
      isAlive,
      imagePath: image.path,
      imageAssetId: image.asset?.id,
      attackAction: buildThreatAttackAction(entity.name, idx, canAct, isAlive),
    };
  });
}

function buildLogEntries(state: GameState): VisualLogEntry[] {
  return (state.log || []).slice(-12).map(entry => {
    return {
      id: entry.id,
      summary: entry.summary,
      flavor: entry.flavor,
      mode: entry.mode,
      createdAt: entry.createdAt,
      actorName: entry.actorName,
    };
  });
}

export function buildVisualGameViewModel(state: GameState): VisualGameViewModel {
  const currentScene = getSceneById(state.storySceneId);
  const aliveThreat = (state.nearbyEntities || []).some(entity => entity.status === 'alive' && entity.hp > 0);
  const canAct = state.hp > 0;
  const turnState: VisualTurnState = {
    mode: state.isCombatActive ? 'combat' : 'solo',
    currentTurnPlayerId: canAct ? SOLO_PLAYER_ID : null,
    canAct,
    reason: canAct ? undefined : 'You are down.',
  };
  const sceneImage = resolveSceneImage(state, currentScene);
  const threats = buildThreatViews(state, canAct);

  return {
    mode: 'solo',
    scene: {
      sceneId: currentScene?.id || state.storySceneId,
      location: currentScene?.location || state.location,
      title: currentScene?.title,
      description: currentScene?.description || state.roomRegistry[state.location] || state.location,
      imagePath: sceneImage.path,
      imageAssetId: sceneImage.asset?.id,
    },
    partySlots: [buildPartySlot(state, turnState)],
    turnState,
    movementActions: buildMovementActions(state, currentScene, aliveThreat),
    explorationActions: buildExplorationActions(canAct, aliveThreat),
    combatActions: buildCombatActions(canAct, aliveThreat),
    inventoryActions: buildInventoryActions(state, canAct),
    spellActions: buildSpellActions(state, canAct),
    threats,
    logEntries: buildLogEntries(state),
    canUseTextFallback: true,
  };
}
