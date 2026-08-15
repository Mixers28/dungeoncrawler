import { MONSTER_MANUAL } from '../../rules';
import { wizardSpellsByName } from '../../5e/reference';
import type { GameState } from '../../game-schema';
import type { ParsedIntent } from '../../5e/intents';
import type { Entity } from '../../game-schema';
import { d20AttackHits, rollCriticalDamage, rollD20, rollDice } from '../dice';
import {
  addActorEffect,
  addMonsterEffect,
  consumeActorSpellSlot,
  restoreActorSpellSlot,
  healActor,
  setActorMinimumAc,
} from '../turn-context';
import { applyXpAndCheckLevelUp } from './progression';
import { normalizeSpellName } from './shared';
import type { TurnDraft } from './turn-draft';

function pickDiceAtLevel(map: Record<string, string> | undefined, level: number): string | null {
  if (!map) return null;
  const levels = Object.keys(map).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (levels.length === 0) return null;
  const chosen = levels.filter(l => l <= level).pop() ?? levels[0];
  return map[String(chosen)] ?? null;
}

function pickDamageDiceFromMechanics(
  mechanics: { damage?: { dice?: string; atSlotLevel?: Record<string, string>; atCharacterLevel?: Record<string, string> }; level?: number },
  characterLevel: number
): string | null {
  if (!mechanics.damage) return null;
  const slotLevel = mechanics.level ?? 1;
  return (
    pickDiceAtLevel(mechanics.damage.atCharacterLevel, characterLevel) ||
    pickDiceAtLevel(mechanics.damage.atSlotLevel, slotLevel) ||
    mechanics.damage.dice ||
    null
  );
}

function pickHealDiceFromMechanics(
  mechanics: { healAtSlotLevel?: Record<string, string>; level?: number }
): string | null {
  if (!mechanics.healAtSlotLevel) return null;
  const slotLevel = mechanics.level ?? 1;
  return pickDiceAtLevel(mechanics.healAtSlotLevel, slotLevel);
}

// 5e-database dice expressions use "MOD" for the caster's spellcasting ability
// modifier (e.g. Cure Wounds "1d8 + MOD"); substitute it before rolling.
function resolveDiceModifiers(dice: string, state: GameState): string {
  if (!/MOD/i.test(dice)) return dice;
  const score = (state.abilityScores || {})[state.spellcastingAbility || 'int'] ?? 10;
  const mod = Math.floor((score - 10) / 2);
  return dice.replace(/\+\s*MOD/i, mod >= 0 ? `+${mod}` : `${mod}`).replace(/MOD/i, `${mod}`);
}

/**
 * The `cast <spell>` branch of the player turn.
 *
 * Gate order mirrors the rules exactly: known -> prepared (cantrips exempt) ->
 * a free `level_<n>` slot. The visual spellbook mirrors these same checks when
 * it decides whether to enable a spell button.
 */
export function resolveSpellCast(
  draft: TurnDraft,
  params: {
    parsedIntent: Extract<ParsedIntent, { type: 'castAbility' }>;
    spellCatalog: typeof wizardSpellsByName;
    activeMonster: Entity | null;
    activeMonsterIndex: number;
    applyDamageToActiveMonster: (damage: number) => void;
  }
): {
  playerAttackRoll: number;
  playerDamageRoll: number;
  playerAttackIsSave: boolean;
  playerAttackDc: number | null;
} {
  const { parsedIntent, spellCatalog, activeMonster, activeMonsterIndex, applyDamageToActiveMonster } = params;
  const newState = draft.state;
  const turnContext = draft.context;
  const summaryParts = draft.summary;
  const rollLog = draft.rolls;
  let playerAttackRoll = 0;
  let playerDamageRoll = 0;
  let playerAttackIsSave = false;
  let playerAttackDc: number | null = null;
  let spentSlotKey: string | null = null;

  const spellKey = parsedIntent.abilityName.toLowerCase();
  const normalizedKey = normalizeSpellName(spellKey);
  const spell = spellCatalog[normalizedKey] || spellCatalog[spellKey];
  const isKnown = (newState.knownSpells || []).some(s => normalizeSpellName(s) === normalizedKey);
  const isPrepared = (newState.preparedSpells || []).some(s => normalizeSpellName(s) === normalizedKey);
  let canCast = true;

  if (!spell || !isKnown) {
    summaryParts.push(`You have not learned that spell.`);
    canCast = false;
  } else if (!isPrepared && !spell.level.toLowerCase().includes('cantrip')) {
    summaryParts.push(`You have not prepared ${spell.name}.`);
    canCast = false;
  } else {
    const isCantrip = spell.level.toLowerCase().includes('cantrip');
    const spellLevelNum = spell.level.match(/\d+/)?.[0] ?? '1';
    const slotKey = `level_${spellLevelNum}`;
    if (!isCantrip) {
      if (!consumeActorSpellSlot(turnContext, slotKey)) {
        summaryParts.push(`You have no ${slotKey.replace('_', ' ')} spell slots left.`);
        canCast = false;
      } else {
        spentSlotKey = slotKey;
        newState.spellSlots = turnContext.actor.spellSlots;
      }
    }

    if (canCast) {
      // Resolve entirely from reference mechanics (5e data + authored overlay).
      const targetName = parsedIntent.target || activeMonster?.name || 'the area';
      const mechanics = spell.mechanics;
      let handledMechanics = false;

      // Area-of-effect damage: hit every alive nearby entity once. The active monster
      // goes through applyDamageToActiveMonster so section-7 handles its XP; other kills
      // are credited inline here (mirrors the section-7 XP formula) to avoid double counting.
      const dealAoeDamage = (dmg: number, damageType: string): number => {
        const aliveBefore = newState.nearbyEntities.filter(e => e.status === 'alive').length;
        if (aliveBefore === 0) return 0;
        if (activeMonsterIndex >= 0 && activeMonster) applyDamageToActiveMonster(dmg);
        newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) => {
          if (idx === activeMonsterIndex || entity.status !== 'alive') return entity;
          const updatedHp = Math.max(0, entity.hp - dmg);
          const died = updatedHp <= 0;
          if (died) {
            newState.totalKills = (newState.totalKills || 0) + 1;
            const xp = MONSTER_MANUAL[entity.name]?.hp ? Math.max(25, MONSTER_MANUAL[entity.name].hp * 5) : 50;
            applyXpAndCheckLevelUp(newState, xp, summaryParts);
          }
          return { ...entity, hp: updatedHp, status: died ? 'dead' : entity.status };
        });
        void damageType;
        return aliveBefore;
      };

      if (mechanics) {
        const healDice = pickHealDiceFromMechanics(mechanics);
        if (healDice) {
          const heal = rollDice(resolveDiceModifiers(healDice, newState));
          newState.hp = healActor(turnContext, heal);
          summaryParts.push(`Healing energy restores ${heal} HP.`);
          handledMechanics = true;
        } else if (mechanics.damage) {
          const rawDamageDice = pickDamageDiceFromMechanics(mechanics, newState.level);
          const damageDice = rawDamageDice ? resolveDiceModifiers(rawDamageDice, newState) : null;
          if (damageDice && mechanics.areaOfEffect && newState.nearbyEntities.some(e => e.status === 'alive')) {
            const damageType = mechanics.damage.type ? mechanics.damage.type.toLowerCase() : 'damage';
            const dmg = rollDice(damageDice);
            playerDamageRoll = dmg;
            const hitCount = dealAoeDamage(dmg, damageType);
            summaryParts.push(`You unleash ${spell.name}, striking ${hitCount} ${hitCount === 1 ? 'foe' : 'foes'} for ${dmg} ${damageType} damage.`);
            handledMechanics = true;
          } else if (damageDice && activeMonster) {
            const damageType = mechanics.damage.type ? mechanics.damage.type.toLowerCase() : 'damage';
            if (mechanics.attackType) {
              const rawSpellD20 = rollD20();
              const spellBonus = newState.spellAttackBonus || 0;
              const spellAttack = rawSpellD20 + spellBonus;
              playerAttackRoll = spellAttack;
              playerAttackIsSave = false;
              playerAttackDc = null;
              if (d20AttackHits(rawSpellD20, spellAttack, activeMonster.ac)) {
                const dmg = rawSpellD20 === 20 ? rollCriticalDamage(damageDice) : rollDice(damageDice);
                playerDamageRoll = dmg;
                applyDamageToActiveMonster(dmg);
                rollLog.push({ label: spell.name, d20: rawSpellD20, modifier: spellBonus, total: spellAttack, against: activeMonster.ac, outcome: rawSpellD20 === 20 ? 'crit' : 'hit', damage: dmg, damageDice, damageType });
                summaryParts.push(`You cast ${spell.name} at ${targetName}, dealing ${dmg} ${damageType} damage.`);
              } else {
                rollLog.push({ label: spell.name, d20: rawSpellD20, modifier: spellBonus, total: spellAttack, against: activeMonster.ac, outcome: 'miss' });
                summaryParts.push(`Your ${spell.name} misses ${targetName}.`);
              }
            } else if (mechanics.dc?.ability) {
              const saveDc = newState.spellSaveDc || 10;
              const rawSaveD20 = rollD20();
              playerAttackRoll = rawSaveD20;
              playerAttackIsSave = true;
              playerAttackDc = saveDc;
              if (rawSaveD20 < saveDc) {
                const dmg = rollDice(damageDice);
                playerDamageRoll = dmg;
                applyDamageToActiveMonster(dmg);
                rollLog.push({ label: `${spell.name} Save`, d20: rawSaveD20, modifier: 0, total: rawSaveD20, against: saveDc, outcome: 'hit', damage: dmg, damageDice, damageType });
                summaryParts.push(`You cast ${spell.name} at ${targetName}, dealing ${dmg} ${damageType} damage.`);
              } else {
                rollLog.push({ label: `${spell.name} Save`, d20: rawSaveD20, modifier: 0, total: rawSaveD20, against: saveDc, outcome: 'miss' });
                summaryParts.push(`${targetName} resists your ${spell.name}.`);
              }
            } else {
              const dmg = rollDice(damageDice);
              playerDamageRoll = dmg;
              playerAttackIsSave = false;
              playerAttackDc = null;
              applyDamageToActiveMonster(dmg);
              summaryParts.push(`You cast ${spell.name} at ${targetName}, dealing ${dmg} ${damageType} damage.`);
            }
            handledMechanics = true;
          }
        }

        // Non-damage effects (buffs, debuffs, utility) from the authored overlay.
        if (!handledMechanics && mechanics.effect) {
          const fx = mechanics.effect;
          if (fx.target === 'self') {
            if (fx.minAc !== undefined) {
              newState.ac = setActorMinimumAc(turnContext, fx.minAc);
            }
            if (fx.type) {
              newState.activeEffects = addActorEffect(turnContext, {
                name: spell.name,
                type: fx.type,
                ...(fx.value !== undefined ? { value: fx.value } : {}),
                ...(fx.durationTurns !== undefined
                  ? { expiresAtTurn: (newState.turnCounter || 0) + fx.durationTurns }
                  : {}),
              });
            }
            summaryParts.push(fx.log || `You cast ${spell.name} on yourself.`);
          } else if (fx.target === 'enemy') {
            if (activeMonster) {
              addMonsterEffect(turnContext, activeMonsterIndex, {
                name: spell.name,
                type: (fx.type === 'buff' ? 'buff' : 'debuff') as 'buff' | 'debuff',
                ...(fx.durationTurns !== undefined
                  ? { expiresAtTurn: (newState.turnCounter || 0) + fx.durationTurns }
                  : {}),
              });
              newState.nearbyEntities = turnContext.session.nearbyEntities;
              summaryParts.push((fx.log || `You cast ${spell.name} at {target}.`).replace('{target}', targetName));
            } else {
              summaryParts.push(fx.missLog || `You cast ${spell.name}, but there is no foe here.`);
            }
          } else {
            summaryParts.push(fx.log || `You cast ${spell.name}.`);
          }
          handledMechanics = true;
        }
      }

      if (!handledMechanics) {
        // Nothing happened, so the slot should not have been spent: casting an
        // attack spell into an empty room used to cost a slot and report the
        // spell as unimplemented.
        const refunded = spentSlotKey ? restoreActorSpellSlot(turnContext, spentSlotKey) : false;
        if (refunded) newState.spellSlots = turnContext.actor.spellSlots;
        const keptNote = refunded ? ' You keep the spell slot.' : '';
        const wantedTarget = !!mechanics?.damage && !pickHealDiceFromMechanics(mechanics);
        summaryParts.push(
          wantedTarget && !activeMonster
            ? `There is nothing here for ${spell.name} to strike.${keptNote}`
            : `You cast ${spell.name}, but its effect is not modeled yet.${keptNote}`
        );
      }
    }
  }

  return { playerAttackRoll, playerDamageRoll, playerAttackIsSave, playerAttackDc };
}
