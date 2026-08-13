import type { GameState, NarrationMode } from '../../game-schema';
import { rollD20, rollDice } from '../dice';
import { DIFFICULTY_TO_DC, type ClassifiedStunt, type StuntTemplate } from '../../stunts';
import { getSkillModifier } from './sheet';
import { normalizeName, pushStoryFlag } from './shared';

// Improvised-action (stunt) classification and effects.
export function applyStuntEffect(
  state: GameState,
  template: StuntTemplate,
  success: boolean,
  targetName?: string
): string {
  if (success) {
    switch (template.successEffect) {
      case 'knockProne': {
        const targetKey = normalizeName(targetName);
        let didApply = false;
        if (targetKey) {
          state.nearbyEntities = state.nearbyEntities.map(entity => {
            const matches = normalizeName(entity.name).includes(targetKey);
            if (!matches) return entity;
            didApply = true;
            return {
              ...entity,
              effects: [
                ...(entity.effects || []),
                { name: 'Prone', type: 'debuff', expiresAtTurn: (state.turnCounter || 0) + 1 },
              ],
            };
          });
        }
        return didApply
          ? `${targetName ? `The ${targetName}` : 'Your target'} is knocked prone.`
          : 'You knock your target off balance.';
      }
      case 'extraDamage':
        state.activeEffects = [
          ...(state.activeEffects || []),
          { name: 'Stunt Edge', type: 'buff', value: 2, expiresAtTurn: (state.turnCounter || 0) + 1 },
        ];
        return 'You set up an opening for a stronger strike.';
      case 'discoverClue':
        pushStoryFlag(state, 'stunt_clue_found');
        return 'You notice a subtle detail you missed before.';
      case 'gainInfo':
        pushStoryFlag(state, 'stunt_info_gained');
        return 'You piece together a useful insight.';
      case 'improveAttitude':
        pushStoryFlag(state, 'stunt_attitude_improved');
        return 'The tension eases, if only slightly.';
      case 'advantage':
        state.activeEffects = [
          ...(state.activeEffects || []),
          { name: 'Stunt Advantage', type: 'buff', expiresAtTurn: (state.turnCounter || 0) + 1 },
        ];
        return 'You gain a brief edge in the next exchange.';
    }
  } else {
    switch (template.failureEffect) {
      case 'takeDamage': {
        const dmg = rollDice('1d4');
        state.hp = Math.max(0, state.hp - dmg);
        return `You overextend and take ${dmg} damage.`;
      }
      case 'losePosition':
        pushStoryFlag(state, 'stunt_lost_position');
        return 'You lose your footing and give ground.';
      case 'alertEnemies':
        pushStoryFlag(state, 'stunt_alerted_enemies');
        return 'Your misstep draws unwanted attention.';
      case 'worsenAttitude':
        pushStoryFlag(state, 'stunt_attitude_worsened');
        return 'Your words sour the mood.';
      case 'wasteAction':
        return 'The attempt goes nowhere.';
      case 'noEffect':
        return '';
    }
  }
  return '';
}

export function resolveStunt(
  currentState: GameState,
  stunt: ClassifiedStunt
): { summary: string; mode: NarrationMode } {
  const { template, targetName } = stunt;
  const dc = DIFFICULTY_TO_DC[template.baseDifficulty];
  const skillName = template.primarySkill;
  const skillMod = getSkillModifier(currentState, skillName);
  const roll = rollD20();
  const total = roll + skillMod;
  const success = total >= dc;
  const resultWord = success ? 'succeed' : 'fail';
  const targetText = targetName ? ` targeting the ${targetName}` : '';

  let mode: NarrationMode = 'GENERAL';
  if (template.category === 'combat' || template.category === 'physical') {
    mode = success ? 'COMBAT_HIT' : 'COMBAT_MISS';
  } else if (template.category === 'mental' || template.category === 'exploration') {
    mode = 'INVESTIGATE';
  }

  let summary =
    `You attempt a ${template.category} stunt${targetText} using ${skillName}. ` +
    `You roll ${total} vs DC ${dc} and ${resultWord}.`;

  const consequenceText = applyStuntEffect(currentState, template, success, targetName);
  if (consequenceText) {
    summary += ` ${consequenceText}`;
  }

  return { summary, mode };
}
