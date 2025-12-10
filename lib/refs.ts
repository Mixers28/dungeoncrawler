import abilities from '../data/5e/abilities.json';
import conditions from '../data/5e/conditions.json';
import basicActions from '../data/5e/basic_actions.json';

type NamedSummary = { name: string; summary: string; abbr?: string };

export const RULES_REFERENCES = {
  abilities: abilities as NamedSummary[],
  conditions: conditions as NamedSummary[],
  basicActions: basicActions as NamedSummary[],
};

export function buildRulesReferenceSnippet() {
  const actions = RULES_REFERENCES.basicActions.slice(0, 6).map(a => `${a.name}: ${a.summary}`).join(' | ');
  const conds = RULES_REFERENCES.conditions.slice(0, 6).map(c => `${c.name}: ${c.summary}`).join(' | ');
  return `ACTIONS: ${actions}\nCONDITIONS: ${conds}`;
}
