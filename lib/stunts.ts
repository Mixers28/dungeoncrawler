export type StuntCategory = 'physical' | 'mental' | 'social' | 'exploration' | 'combat';

export interface StuntTemplate {
  id: string;
  category: StuntCategory;
  primarySkill: string;
  backupSkills?: string[];
  baseDifficulty: 'easy' | 'moderate' | 'hard' | 'deadly';
  successEffect: 'advantage' | 'extraDamage' | 'knockProne' | 'discoverClue' | 'gainInfo' | 'improveAttitude';
  failureEffect: 'takeDamage' | 'losePosition' | 'alertEnemies' | 'wasteAction' | 'worsenAttitude' | 'noEffect';
}

export const DIFFICULTY_TO_DC: Record<StuntTemplate['baseDifficulty'], number> = {
  easy: 10,
  moderate: 13,
  hard: 16,
  deadly: 20,
};

export const STUNT_TEMPLATES: Record<string, StuntTemplate> = {
  physical_default: {
    id: 'physical_default',
    category: 'physical',
    primarySkill: 'Athletics',
    backupSkills: ['Acrobatics'],
    baseDifficulty: 'hard',
    successEffect: 'knockProne',
    failureEffect: 'losePosition',
  },
  mental_default: {
    id: 'mental_default',
    category: 'mental',
    primarySkill: 'Investigation',
    backupSkills: ['Perception', 'History'],
    baseDifficulty: 'moderate',
    successEffect: 'discoverClue',
    failureEffect: 'noEffect',
  },
  social_default: {
    id: 'social_default',
    category: 'social',
    primarySkill: 'Persuasion',
    backupSkills: ['Intimidation', 'Deception'],
    baseDifficulty: 'moderate',
    successEffect: 'improveAttitude',
    failureEffect: 'worsenAttitude',
  },
  exploration_default: {
    id: 'exploration_default',
    category: 'exploration',
    primarySkill: 'Perception',
    backupSkills: ['Investigation'],
    baseDifficulty: 'moderate',
    successEffect: 'discoverClue',
    failureEffect: 'alertEnemies',
  },
  combat_trick_default: {
    id: 'combat_trick_default',
    category: 'combat',
    primarySkill: 'Acrobatics',
    backupSkills: ['Athletics'],
    baseDifficulty: 'hard',
    successEffect: 'extraDamage',
    failureEffect: 'takeDamage',
  },
};

export interface ClassifiedStunt {
  template: StuntTemplate;
  targetName?: string;
}

export function classifyStunt(userAction: string): ClassifiedStunt | null {
  const text = userAction.toLowerCase();

  const targetMatch = text.match(/\b(on|at|against|to)\s+([a-z]+)\b/);
  const targetName = targetMatch?.[2];

  if (/(jump|leap|vault|climb|swing|flip|tackle|grab|shove|push|ram|charge)/.test(text)) {
    return { template: STUNT_TEMPLATES.physical_default, targetName };
  }

  if (/(persuade|convince|negotiate|charm|intimidate|threaten|scare|bluff|lie|deceive|talk my way)/.test(text)) {
    return { template: STUNT_TEMPLATES.social_default, targetName };
  }

  if (/(study|examine|ponder|recall|remember|history|arcana|religion|investigate|inspect|analyze)/.test(text)) {
    return { template: STUNT_TEMPLATES.mental_default, targetName };
  }

  if (/(poke|prod|test|press|turn|pull|push the lever|trap|mechanism|device|lock)/.test(text)) {
    return { template: STUNT_TEMPLATES.exploration_default, targetName };
  }

  if (/(trip|disarm|feint|kick sand|bash|slam|throw sand|throw dirt)/.test(text)) {
    return { template: STUNT_TEMPLATES.combat_trick_default, targetName };
  }

  return null;
}
