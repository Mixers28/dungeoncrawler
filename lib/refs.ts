import abilities from '../data/5e/abilities.json';
import conditions from '../data/5e/conditions.json';
import basicActions from '../data/5e/basic_actions.json';
import skills from '../data/5e/skills.json';
import weapons from '../data/5e/weapons.json';
import armor from '../data/5e/armor.json';

type NamedSummary = { name: string; summary: string; abbr?: string };

export const RULES_REFERENCES = {
  abilities: abilities as NamedSummary[],
  conditions: conditions as NamedSummary[],
  basicActions: basicActions as NamedSummary[],
  skills: skills as { name: string; ability: string }[],
  weapons: weapons as { name: string; category: string; damage: string; properties: string[]; weight_lb?: number }[],
  armor: armor as { name: string; category: string; baseAC: number; maxDex: number | string; stealthDisadvantage: boolean; weight_lb?: number; strengthRequirement?: number }[],
};

export function buildRulesReferenceSnippet() {
  const actions = RULES_REFERENCES.basicActions.slice(0, 6).map(a => `${a.name}: ${a.summary}`).join(' | ');
  const conds = RULES_REFERENCES.conditions.slice(0, 4).map(c => `${c.name}: ${c.summary}`).join(' | ');
  const skillsSnippet = RULES_REFERENCES.skills.slice(0, 6).map(s => `${s.name} (${s.ability})`).join(', ');
  return `ACTIONS: ${actions}\nCONDITIONS: ${conds}\nSKILLS: ${skillsSnippet}`;
}
