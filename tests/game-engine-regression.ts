import assert from 'node:assert/strict';
import { parseActionIntentWithKnown } from '../lib/5e/intents';
import { parseIntent } from '../lib/game/intent';
import { runGameTurn } from '../lib/game/engine';
import { buildNewGameState } from '../lib/game/state';
import { resolveWeaponId } from '../lib/items';
import type { Entity, GameState } from '../lib/game-schema';

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

async function main() {
  await testParserInventoryCommands();
  await testEquipWeapon();
  await testDropConsumableAndKeepKeys();
  await testRejectUnownedWeapon();
  await testRequestedOwnedWeaponUsesMatchingDice();
  await testAttackHonorsTarget();

  console.log('game-engine regression tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
