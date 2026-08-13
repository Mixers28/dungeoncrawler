import { d20AttackHits, rollCriticalDamage, rollD20, rollDice } from '../dice';
import type { CoreActionIntent } from '../intent';
import {
  applyDamageToActor,
  getMonsterTargetByIndex,
  syncTurnContextFromGameState,
} from '../turn-context';
import { getBaseAcFromEquipped, getPlayerAc } from './sheet';
import type { TurnDraft } from './turn-draft';

// Conditions that fully prevent the monster from acting this turn.
const DISABLING_CONDITIONS = ['mage hand', 'stunned', 'paralyzed', 'held', 'frightened', 'sleep'];

/**
 * Section 5: the monster's retaliation, resolved only when it is still alive,
 * combat is live, and the player did not run.
 *
 * Returns the rolls the accountant facts report; damage is applied to `draft`.
 */
export function resolveMonsterTurn(
  draft: TurnDraft,
  params: {
    activeMonsterIndex: number;
    actionIntent: CoreActionIntent;
    shouldResolveMonsterTurn: boolean;
    isCastAbility: boolean;
  }
): { monsterAttackRoll: number; monsterDamageRoll: number } {
  const { state, context } = draft;
  const { activeMonsterIndex, actionIntent, shouldResolveMonsterTurn, isCastAbility } = params;

  let monsterAttackRoll = 0;
  let monsterDamageRoll = 0;

  syncTurnContextFromGameState(context, state);
  const monster = getMonsterTargetByIndex(context, activeMonsterIndex).entity;
  const monsterStillAlive = monster && monster.status === 'alive';
  const monsterIsActive = state.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend';

  if (shouldResolveMonsterTurn && monsterStillAlive && monsterIsActive && actionIntent !== 'run') {
    const disablingEffect = (monster.effects || [])
      .find(effect => DISABLING_CONDITIONS.includes(effect.name.toLowerCase()));
    if (disablingEffect) {
      const condition = disablingEffect.name.toLowerCase() === 'mage hand'
        ? 'pinned by the spectral hand'
        : disablingEffect.name.toLowerCase();
      draft.summary.push(`${monster.name} is ${condition} and cannot attack this moment.`);
      return { monsterAttackRoll, monsterDamageRoll };
    }

    const rawMonsterD20 = rollD20();
    // Bane (5e): target takes -1d4 to attack rolls.
    const hasBane = (monster.effects || []).some(effect => effect.name.toLowerCase() === 'bane');
    const banePenalty = hasBane ? rollDice('1d4') : 0;
    const monsterBonus = monster.attackBonus - banePenalty;
    monsterAttackRoll = rawMonsterD20 + monsterBonus;
    const monsterDamageNotation = monster.damageDice;
    const playerAc = getPlayerAc(state, getBaseAcFromEquipped(state));
    const baneNote = hasBane ? ` (Bane -${banePenalty})` : '';

    if (d20AttackHits(rawMonsterD20, monsterAttackRoll, playerAc)) {
      monsterDamageRoll = rawMonsterD20 === 20
        ? rollCriticalDamage(monsterDamageNotation)
        : rollDice(monsterDamageNotation);
      state.hp = applyDamageToActor(context, monsterDamageRoll);
      draft.rolls.push({
        label: `${monster.name}${baneNote}`,
        d20: rawMonsterD20,
        modifier: monsterBonus,
        total: monsterAttackRoll,
        against: playerAc,
        outcome: rawMonsterD20 === 20 ? 'crit' : 'hit',
        damage: monsterDamageRoll,
        damageDice: monsterDamageNotation,
      });
      draft.summary.push(`${monster.name} hits you for ${monsterDamageRoll} damage.`);
    } else {
      draft.rolls.push({
        label: `${monster.name}${baneNote}`,
        d20: rawMonsterD20,
        modifier: monsterBonus,
        total: monsterAttackRoll,
        against: playerAc,
        outcome: 'miss',
      });
      draft.summary.push(`${monster.name} misses you${hasBane ? ', its cursed strike going wide' : ''}.`);
    }
  } else if (!monsterStillAlive && actionIntent === 'attack' && !isCastAbility) {
    draft.summary.push('There is nothing left to attack.');
  }

  return { monsterAttackRoll, monsterDamageRoll };
}
