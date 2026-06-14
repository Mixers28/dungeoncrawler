import levels from '../data/progression/levels.json';

export interface LevelDef {
  level: number;
  xpRequired: number;
  hpGain: number;
  proficiencyBonus: number;
}

const LEVELS: LevelDef[] = levels as LevelDef[];

export function getNextLevelDef(currentLevel: number): LevelDef | null {
  return LEVELS.find(def => def.level === currentLevel + 1) ?? null;
}
