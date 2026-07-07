import assert from 'node:assert/strict';
import { parseActionIntentWithKnown } from '../lib/5e/intents';
import { parseIntent } from '../lib/game/intent';
import { runGameTurn } from '../lib/game/engine';
import { buildNewGameState } from '../lib/game/state';
import { composeGameStateForSolo, splitGameStateForSolo } from '../lib/game/state-split';
import { applyDamageToMonsterTarget, createTurnContextFromGameState, findActiveMonsterTarget } from '../lib/game/turn-context';
import { resolveWeaponId } from '../lib/items';
import { getSceneById, pickSceneVariant } from '../lib/story';
import { getVisualAsset, visualAssetManifest } from '../lib/visual/assets';
import { buildVisualGameViewModel } from '../lib/visual/view-model';
import { characterStateSchema, gameStateSchema, sessionStateSchema, type Entity, type GameState } from '../lib/game-schema';

function makeMonster(name: string, hp = 20): Entity {
  return {
    name,
    status: 'alive',
    description: name,
    hp,
    maxHp: hp,
    ac: 1,
    attackBonus: -20,
    damageDice: '1d1',
    effects: [],
  };
}

async function makeState(): Promise<GameState> {
  const state = await buildNewGameState('fighter');
  return {
    ...state,
    hp: state.maxHp,
    nearbyEntities: [],
    isCombatActive: false,
    log: [],
    narrativeHistory: [],
  };
}

async function turn(state: GameState, command: string) {
  return runGameTurn(state, parseIntent(command, state));
}

function clearThreats(state: GameState): GameState {
  return {
    ...state,
    nearbyEntities: [],
    isCombatActive: false,
  };
}

function withStory(state: GameState, sceneId: string, flags: string[]): GameState {
  const scene = getSceneById(sceneId);
  assert.ok(scene, `Missing test scene ${sceneId}`);
  return clearThreats({
    ...state,
    storySceneId: scene.id,
    location: scene.location,
    roomRegistry: {
      ...state.roomRegistry,
      [scene.location]: scene.description || scene.location,
    },
    storyFlags: flags,
  });
}

async function testParserInventoryCommands() {
  assert.deepEqual(parseActionIntentWithKnown('equip handaxe', [], []), {
    type: 'equip',
    itemName: 'handaxe',
  });
  assert.deepEqual(parseActionIntentWithKnown('drop the healing potion', [], []), {
    type: 'drop',
    itemName: 'healing potion',
  });
}

async function testEquipWeapon() {
  const state = await makeState();
  const { newState, logEntry } = await turn(state, 'equip handaxe');

  assert.match(logEntry.summary, /equip handaxe/i);
  assert.equal(newState.equippedWeaponId, resolveWeaponId('Handaxe'));
  assert.equal(newState.inventory.find(item => item.name === 'Handaxe')?.equipped, true);
  assert.equal(newState.inventory.find(item => item.name === 'Longsword')?.equipped, false);
}

async function testDropConsumableAndKeepKeys() {
  const state = await makeState();
  const withKey: GameState = {
    ...state,
    inventory: [
      ...state.inventory,
      { id: 'test-key', name: 'Iron Key', type: 'key', quantity: 1, equipped: false },
    ],
  };

  const droppedPotion = await turn(withKey, 'drop healing potion');
  assert.equal(
    droppedPotion.newState.inventory.some(item => item.name === 'Healing Potion'),
    false
  );

  const keptKey = await turn(droppedPotion.newState, 'drop iron key');
  assert.match(keptKey.logEntry.summary, /too important/i);
  assert.equal(
    keptKey.newState.inventory.some(item => item.name === 'Iron Key'),
    true
  );
}

async function testRejectUnownedWeapon() {
  const state = await makeState();
  const monster = makeMonster('Skeleton', 20);
  const combatState: GameState = {
    ...state,
    nearbyEntities: [monster],
    isCombatActive: true,
  };

  const { newState, logEntry } = await turn(combatState, 'attack with greatsword');

  assert.match(logEntry.summary, /do not have greatsword/i);
  assert.equal(logEntry.rolls, undefined);
  assert.equal(newState.nearbyEntities[0].hp, monster.hp);
}

async function testRequestedOwnedWeaponUsesMatchingDice() {
  const state = await makeState();
  const combatState: GameState = {
    ...state,
    nearbyEntities: [makeMonster('Skeleton', 20)],
    isCombatActive: true,
  };

  const { logEntry } = await turn(combatState, 'attack with handaxe');

  assert.equal(logEntry.rolls?.[0]?.label, 'Your Attack');
  assert.equal(logEntry.rolls?.[0]?.damageDice, '1d6');
  assert.match(logEntry.summary, /with Handaxe/i);
}

async function testAttackHonorsTarget() {
  const state = await makeState();
  const combatState: GameState = {
    ...state,
    nearbyEntities: [makeMonster('Zombie', 20), makeMonster('Skeleton', 20)],
    isCombatActive: true,
  };

  const { newState } = await turn(combatState, 'attack skeleton');

  assert.equal(newState.nearbyEntities[0].hp, 20);
  assert.ok(newState.nearbyEntities[1].hp < 20);
}

async function testPhase1HubBranchAndBossGates() {
  const state = await makeState();
  const hub = getSceneById('future_courtyard_hub_v1');
  assert.ok(hub);

  const branchTargets = new Set(
    hub.exits
      ?.filter(exit => exit.targetSceneId.includes('_branch_'))
      .map(exit => exit.targetSceneId)
  );
  assert.deepEqual(branchTargets, new Set([
    'future_hallway_branch_v1',
    'future_shrine_branch_v1',
    'future_cellar_branch_v1',
  ]));

  const lockedBoss = await turn(
    withStory(state, 'future_courtyard_hub_v1', ['gate_opened', 'courtyard_cleared']),
    'boss'
  );
  assert.equal(lockedBoss.newState.storySceneId, 'future_courtyard_hub_v1');
  assert.match(lockedBoss.logEntry.summary, /haven't yet done what's needed/i);

  const unlockedBoss = await turn(
    withStory(state, 'future_courtyard_hub_v1', [
      'gate_opened',
      'courtyard_cleared',
      'branch_a_cleared',
      'branch_b_cleared',
      'branch_c_cleared',
    ]),
    'boss'
  );
  assert.match(unlockedBoss.newState.storySceneId, /^future_bossroom_v[12]$/);
  assert.equal(unlockedBoss.newState.location, 'Sunken Throne');
}

async function testPhase1ConsumeItemGate() {
  const state = await makeState();
  const hallwayState = withStory(state, 'future_hallway_branch_v1', ['gate_opened', 'courtyard_cleared']);

  const lockedArmory = await turn(hallwayState, 'armory');
  assert.equal(lockedArmory.newState.storySceneId, 'future_hallway_branch_v1');
  assert.match(lockedArmory.logEntry.summary, /need Armory Key/i);

  const withKey: GameState = {
    ...hallwayState,
    inventory: [
      ...hallwayState.inventory,
      { id: 'armory-key', name: 'Armory Key', type: 'key', quantity: 1, equipped: false },
    ],
  };
  const enteredArmory = await turn(withKey, 'armory');

  assert.match(enteredArmory.newState.storySceneId, /^future_armory_side_v[12]$/);
  assert.equal(
    enteredArmory.newState.inventory.some(item => item.name === 'Armory Key'),
    false
  );
  assert.ok(enteredArmory.newState.inventoryChangeLog.includes('Used Armory Key'));
}

async function testPhase1DiscoveryAndBranchCompletion() {
  const state = await makeState();
  const hallwayState = withStory(state, 'future_hallway_branch_v1', ['gate_opened', 'courtyard_cleared']);
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const searched = await turn(hallwayState, 'search the hallway');
    assert.equal(
      searched.newState.inventory.some(item => item.name === 'Armory Key'),
      true
    );
    assert.ok(searched.newState.storyFlags.includes('found_armory_key'));
  } finally {
    Math.random = originalRandom;
  }

  const returnedToHub = await turn(hallwayState, 'back to courtyard');
  assert.ok(returnedToHub.newState.storyFlags.includes('branch_a_cleared'));
  assert.match(returnedToHub.newState.storySceneId, /^future_courtyard_hub_v[12]$/);
}

async function testPhase1SeededVariants() {
  const group = 'future_act1_hub';
  const firstPick = pickSceneVariant(group, 100);
  const secondPick = pickSceneVariant(group, 100);
  const differentPick = pickSceneVariant(group, 101);

  assert.ok(firstPick);
  assert.ok(secondPick);
  assert.ok(differentPick);
  assert.equal(firstPick.id, secondPick.id);
  assert.notEqual(firstPick.id, differentPick.id);
}

async function testSoloStateSplitRoundTrip() {
  const state = await makeState();
  const parsed = gameStateSchema.parse({
    ...state,
    log: [
      {
        id: 'log-actor',
        mode: 'GENERAL',
        summary: 'Ana opens the gate.',
        actorName: 'Ana',
        createdAt: '2026-07-07T00:00:00.000Z',
      },
    ],
  });
  const { session, character } = splitGameStateForSolo(parsed);
  const recomposed = composeGameStateForSolo(session, character);

  assert.deepEqual(recomposed, parsed);
  assert.equal(session.turnOrder[0], 'solo');
  assert.equal(session.currentTurnPlayerId, 'solo');
  assert.equal(character.playerId, 'solo');
  assert.equal(session.log[0].actorName, 'Ana');
}

async function testSoloStateSplitFieldOwnership() {
  const state = await makeState();
  const combatState: GameState = {
    ...state,
    storySceneId: 'future_hallway_branch_v1',
    storyFlags: ['gate_opened'],
    nearbyEntities: [makeMonster('Zombie', 12)],
    isCombatActive: true,
    inventory: [
      ...state.inventory,
      { id: 'test-key', name: 'Iron Key', type: 'key', quantity: 1, equipped: false },
    ],
  };
  const { session, character } = splitGameStateForSolo(combatState);

  sessionStateSchema.parse(session);
  characterStateSchema.parse(character);
  assert.equal(session.storySceneId, 'future_hallway_branch_v1');
  assert.deepEqual(session.storyFlags, ['gate_opened']);
  assert.equal(session.nearbyEntities[0].name, 'Zombie');
  assert.equal(character.inventory.some(item => item.name === 'Iron Key'), true);
  assert.equal(character.hp, combatState.hp);
}

async function testSoloStateSplitDyingCharacterCannotAct() {
  const state = await makeState();
  const { session, character } = splitGameStateForSolo({ ...state, hp: 0 });

  assert.equal(character.hp, 0);
  assert.equal(session.currentTurnPlayerId, null);
}

async function testTurnContextFindsAndDamagesMonsterTarget() {
  const state = await makeState();
  const context = createTurnContextFromGameState({
    ...state,
    nearbyEntities: [makeMonster('Zombie', 20), makeMonster('Skeleton Spearman', 15)],
    isCombatActive: true,
  });
  const target = findActiveMonsterTarget(context, 'spearman');
  const result = applyDamageToMonsterTarget(context, target.index, 7);

  assert.equal(target.index, 1);
  assert.equal(target.entity?.name, 'Skeleton Spearman');
  assert.equal(result.status, 'hit');
  assert.equal(context.session.nearbyEntities[0].hp, 20);
  assert.equal(context.session.nearbyEntities[1].hp, 8);
}

async function testTurnContextKillsMonsterTarget() {
  const state = await makeState();
  const context = createTurnContextFromGameState({
    ...state,
    nearbyEntities: [makeMonster('Zombie', 5)],
    isCombatActive: true,
  });
  const target = findActiveMonsterTarget(context);
  const result = applyDamageToMonsterTarget(context, target.index, 5);

  assert.equal(result.status, 'kill');
  assert.equal(context.session.nearbyEntities[0].hp, 0);
  assert.equal(context.session.nearbyEntities[0].status, 'dead');
}

async function testVisualAssetManifestLoads() {
  assert.equal(visualAssetManifest.styleVersion, 'visual-phase0-v1');
  assert.ok(visualAssetManifest.assets.length > 0);
  assert.equal(getVisualAsset('scene', 'iron_gate_v1')?.path, '/scene-cache/the_iron_gate_v1.jpg');
  assert.equal(getVisualAsset('monster', 'Fallen Knight')?.path, '/visual/monsters/fallback.svg');
  assert.equal(getVisualAsset('item', 'Healing Potion')?.path, '/visual/items/fallback.svg');
  assert.equal(getVisualAsset('item', 'missing-item'), null);
}

async function testVisualAct1SceneManifestCoverage() {
  const act1SceneIds = [
    'iron_gate_v1',
    'iron_gate_v2',
    'future_courtyard_hub_v1',
    'future_courtyard_hub_v2',
    'future_hallway_branch_v1',
    'future_hallway_branch_v2',
    'future_shrine_branch_v1',
    'future_shrine_branch_v2',
    'future_cellar_branch_v1',
    'future_cellar_branch_v2',
    'future_armory_side_v1',
    'future_armory_side_v2',
    'future_cache_side_v1',
    'future_cache_side_v2',
    'future_sanctum_side_v1',
    'future_sanctum_side_v2',
    'future_bossroom_v1',
    'future_bossroom_v2',
    'future_treasury_v1',
    'future_treasury_v2',
  ];

  for (const sceneId of act1SceneIds) {
    const asset = getVisualAsset('scene', sceneId);
    assert.ok(asset, `Missing visual scene asset for ${sceneId}`);
    assert.notEqual(asset.id, 'fallback_scene');
    assert.ok(asset.path.startsWith('/'), `Scene asset path must be public-rooted for ${sceneId}`);
  }
}

async function testVisualViewModelSoloContract() {
  const state = await makeState();
  const view = buildVisualGameViewModel(state);

  assert.equal(view.mode, 'solo');
  assert.equal(view.partySlots.length, 1);
  assert.equal(view.partySlots[0].playerId, 'solo');
  assert.equal(view.partySlots[0].isYou, true);
  assert.equal(view.turnState.currentTurnPlayerId, 'solo');
  assert.equal(view.turnState.canAct, true);
  assert.ok(view.scene.imagePath.startsWith('/'));
  assert.ok(view.movementActions.some(action => action.command === 'open' && action.enabled));
}

async function testVisualViewModelGatesBossMovement() {
  const state = await makeState();
  const lockedHub = withStory(state, 'future_courtyard_hub_v1', ['gate_opened', 'courtyard_cleared']);
  const lockedView = buildVisualGameViewModel(lockedHub);
  const lockedBoss = lockedView.movementActions.find(action => action.targetId?.startsWith('future_bossroom'));

  assert.ok(lockedBoss);
  assert.equal(lockedBoss.enabled, false);
  assert.match(lockedBoss.reason || '', /requires more progress/i);

  const unlockedHub = withStory(state, 'future_courtyard_hub_v1', [
    'gate_opened',
    'courtyard_cleared',
    'branch_a_cleared',
    'branch_b_cleared',
    'branch_c_cleared',
  ]);
  const unlockedView = buildVisualGameViewModel(unlockedHub);
  const unlockedBoss = unlockedView.movementActions.find(action => action.targetId?.startsWith('future_bossroom'));

  assert.ok(unlockedBoss);
  assert.equal(unlockedBoss.enabled, true);
}

async function testVisualViewModelConsumeItemGate() {
  const state = await makeState();
  const hallwayState = withStory(state, 'future_hallway_branch_v1', ['gate_opened', 'courtyard_cleared']);
  const lockedView = buildVisualGameViewModel(hallwayState);
  const lockedArmory = lockedView.movementActions.find(action => action.targetId?.startsWith('future_armory_side'));

  assert.ok(lockedArmory);
  assert.equal(lockedArmory.enabled, false);
  assert.match(lockedArmory.reason || '', /requires armory key/i);

  const withKey: GameState = {
    ...hallwayState,
    inventory: [
      ...hallwayState.inventory,
      { id: 'armory-key', name: 'Armory Key', type: 'key', quantity: 1, equipped: false },
    ],
  };
  const unlockedView = buildVisualGameViewModel(withKey);
  const unlockedArmory = unlockedView.movementActions.find(action => action.targetId?.startsWith('future_armory_side'));

  assert.ok(unlockedArmory);
  assert.equal(unlockedArmory.enabled, true);
}

async function testVisualViewModelThreatAttackActions() {
  const state = await makeState();
  const combatState: GameState = {
    ...state,
    nearbyEntities: [makeMonster('Zombie', 20), makeMonster('Skeleton Spearman', 15)],
    isCombatActive: true,
  };

  const view = buildVisualGameViewModel(combatState);

  assert.equal(view.threats.length, 2);
  assert.equal(view.threats[0].attackAction?.command, 'attack zombie');
  assert.equal(view.threats[0].attackAction?.enabled, true);
  assert.equal(view.threats[1].attackAction?.command, 'attack skeleton spearman');
  assert.equal(view.threats[1].attackAction?.targetId, view.threats[1].id);
  assert.equal(view.threats[1].imagePath, '/visual/monsters/fallback.svg');
  assert.equal(view.threats[1].imageAssetId, 'skeleton_spearman');
}

async function testVisualViewModelInventoryActionAssets() {
  const state = await makeState();
  const view = buildVisualGameViewModel(state);
  const potion = view.inventoryActions.find(action => /healing potion/i.test(action.label));

  assert.ok(potion);
  assert.equal(potion.imagePath, '/visual/items/fallback.svg');
  assert.equal(potion.imageAssetId, 'healing_potion');
}

async function testVisualViewModelActorNamedLogs() {
  const state = await makeState();
  const view = buildVisualGameViewModel({
    ...state,
    log: [
      {
        id: 'log-actor',
        mode: 'GENERAL',
        summary: 'Ana searches the alcove.',
        actorName: 'Ana',
        createdAt: '2026-07-07T00:00:00.000Z',
      },
    ],
  });

  assert.equal(view.logEntries[0].actorName, 'Ana');
}

async function main() {
  await testParserInventoryCommands();
  await testEquipWeapon();
  await testDropConsumableAndKeepKeys();
  await testRejectUnownedWeapon();
  await testRequestedOwnedWeaponUsesMatchingDice();
  await testAttackHonorsTarget();
  await testPhase1HubBranchAndBossGates();
  await testPhase1ConsumeItemGate();
  await testPhase1DiscoveryAndBranchCompletion();
  await testPhase1SeededVariants();
  await testSoloStateSplitRoundTrip();
  await testSoloStateSplitFieldOwnership();
  await testSoloStateSplitDyingCharacterCannotAct();
  await testTurnContextFindsAndDamagesMonsterTarget();
  await testTurnContextKillsMonsterTarget();
  await testVisualAssetManifestLoads();
  await testVisualAct1SceneManifestCoverage();
  await testVisualViewModelSoloContract();
  await testVisualViewModelGatesBossMovement();
  await testVisualViewModelConsumeItemGate();
  await testVisualViewModelThreatAttackActions();
  await testVisualViewModelInventoryActionAssets();
  await testVisualViewModelActorNamedLogs();

  console.log('game-engine regression tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
