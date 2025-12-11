import { weapons, basicActions, skills, abilityScores } from './reference';

export type ParsedIntent =
  | { type: 'castAbility'; abilityName: string; target?: string }
  | { type: 'attack'; target?: string; weaponName?: string }
  | { type: 'defend' }
  | { type: 'run' }
  | { type: 'look' }
  | { type: 'checkSheet'; section?: 'skills' | 'abilities' | 'inventory' | 'all' }
  | { type: 'move'; direction?: string }
  | { type: 'other'; raw: string };

const weaponNames = weapons.map(w => w.name.toLowerCase());
const abilityNames = abilityScores.map(a => a.name.toLowerCase());
const skillNames = skills.map(s => s.name.toLowerCase());
const basicActionNames = basicActions.map(a => a.name.toLowerCase());

function findWeaponName(text: string): string | undefined {
  const lower = text.toLowerCase();
  return weaponNames.find(name => lower.includes(name));
}

function findTarget(text: string): string | undefined {
  const match = text.match(/\b(?:on|at|against|toward|targeting|vs\.?)\s+([a-z][a-z\s'-]{1,40})/i);
  if (match) return match[1].trim();
  const direct = text.match(/\b(?:the|a|an)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (direct) return direct[1].trim();
  return undefined;
}

function findDirection(text: string): string | undefined {
  const match = text.match(/\b(north|south|east|west|left|right|forward|back|backward|forwards)\b/i);
  return match ? match[1].toLowerCase() : undefined;
}

function isCheckSheet(text: string): { section?: 'skills' | 'abilities' | 'inventory' | 'all' } | null {
  if (/(inventory|bag|pack)/i.test(text)) return { section: 'inventory' };
  if (/(skills|proficiencies)/i.test(text)) return { section: 'skills' };
  if (/(abilities|spells|feats|powers)/i.test(text)) return { section: 'abilities' };
  if (/(character sheet|sheet|stats|status)/i.test(text)) return { section: 'all' };
  return null;
}

export function parseActionIntent(raw: string): ParsedIntent {
  return parseActionIntentWithKnown(raw, []);
}

export function parseActionIntentWithKnown(raw: string, knownSpells: string[]): ParsedIntent {
  const text = raw.trim();

  const sheetSection = isCheckSheet(text);
  if (sheetSection) {
    return { type: 'checkSheet', section: sheetSection.section };
  }

  if (/\b(look|inspect|examine|search|survey|observe)\b/i.test(text)) {
    return { type: 'look' };
  }

  if (/\b(run|flee|escape|retreat)\b/i.test(text)) {
    return { type: 'run' };
  }

  if (/\b(defend|block|dodge|parry|guard|brace|shield up)\b/i.test(text)) {
    return { type: 'defend' };
  }

  const direction = findDirection(text);
  if (/\b(move|go|walk|head|proceed|travel)\b/i.test(text) && direction) {
    return { type: 'move', direction };
  }

  // Ability/spell casting (prefer known spells when provided)
  const castMatch = text.match(/\b(?:cast|use|invoke|activate)\s+([a-z][a-z\s'-]{2,40})/i);
  if (castMatch) {
    const abilityCandidate = castMatch[1].trim();
    const lowerCandidate = abilityCandidate.toLowerCase();
    const knownMatch = knownSpells.find(s => s.toLowerCase() === lowerCandidate || lowerCandidate.includes(s.toLowerCase()));
    if (knownMatch) {
      return { type: 'castAbility', abilityName: knownMatch, target: findTarget(text) };
    }
    const abilityKey = abilityNames.find(name => lowerCandidate.includes(name));
    if (abilityKey) {
      return { type: 'castAbility', abilityName: abilityCandidate, target: findTarget(text) };
    }
  }

  const weaponName = findWeaponName(text);
  if (/(attack|hit|strike|stab|slash|swing|shoot|swing|bash|punch|kick)/i.test(text) || weaponName) {
    return {
      type: 'attack',
      weaponName,
      target: findTarget(text),
    };
  }

  if (basicActionNames.some(name => text.toLowerCase().includes(name))) {
    return { type: 'checkSheet', section: 'all' };
  }

  if (skillNames.some(name => text.toLowerCase().includes(name))) {
    return { type: 'checkSheet', section: 'skills' };
  }

  return { type: 'other', raw };
}
