'use client';

import type { GameState } from '../lib/game-schema';

interface Hint {
  label: string;
  cmd: string;
  color: 'red' | 'blue' | 'purple' | 'green' | 'amber' | 'slate';
}

function buildHints(state: GameState): Hint[] {
  const { isCombatActive, nearbyEntities, inventory, preparedSpells, knownSpells, hp, maxHp, location } = state;
  const hasPotion = inventory.some(i => i.name.toLowerCase().includes('potion') && i.quantity > 0);
  const hasBandage = inventory.some(i => i.name.toLowerCase().includes('bandage') && i.quantity > 0);
  const combined = [...(preparedSpells || []), ...(knownSpells || [])];
  const allSpells = combined.filter((s, i) => combined.indexOf(s) === i);
  const firstSpell = allSpells[0];
  const hasTrader = location.toLowerCase().includes('gate');
  const roomClear = !nearbyEntities.some(e => e.status === 'alive');

  if (isCombatActive) {
    const hints: Hint[] = [
      { label: 'Attack', cmd: 'attack', color: 'red' },
      { label: 'Defend', cmd: 'defend', color: 'blue' },
    ];
    if (firstSpell) hints.push({ label: `Cast ${firstSpell}`, cmd: `cast ${firstSpell}`, color: 'purple' });
    if (hasPotion) hints.push({ label: 'Use Potion', cmd: 'use potion', color: 'green' });
    else if (hasBandage) hints.push({ label: 'Use Bandage', cmd: 'use bandage', color: 'green' });
    hints.push({ label: 'Run', cmd: 'run', color: 'slate' });
    return hints;
  }

  const hints: Hint[] = [
    { label: 'Look', cmd: 'look', color: 'slate' },
    { label: 'Search', cmd: 'search', color: 'slate' },
  ];
  if (roomClear && hp < maxHp) hints.push({ label: 'Rest', cmd: 'rest', color: 'green' });
  if (hasPotion && hp < maxHp) hints.push({ label: 'Use Potion', cmd: 'use potion', color: 'green' });
  else if (hasBandage && hp < maxHp) hints.push({ label: 'Use Bandage', cmd: 'use bandage', color: 'green' });
  if (hasTrader) hints.push({ label: 'Open Shop', cmd: 'talk to trader', color: 'amber' });
  return hints;
}

const colorMap: Record<Hint['color'], string> = {
  red:    'bg-red-900/40 border-red-700 text-red-300 hover:bg-red-800/60',
  blue:   'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-800/60',
  purple: 'bg-purple-900/40 border-purple-700 text-purple-300 hover:bg-purple-800/60',
  green:  'bg-green-900/40 border-green-700 text-green-300 hover:bg-green-800/60',
  amber:  'bg-amber-900/40 border-amber-700 text-amber-300 hover:bg-amber-800/60',
  slate:  'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/60',
};

interface CommandHintsProps {
  gameState: GameState;
  onCommand: (cmd: string) => void;
  isLoading: boolean;
}

export function CommandHints({ gameState, onCommand, isLoading }: CommandHintsProps) {
  const hints = buildHints(gameState);
  if (hints.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2 px-1">
      {hints.map(h => (
        <button
          key={h.cmd}
          onClick={() => onCommand(h.cmd)}
          disabled={isLoading}
          className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colorMap[h.color]}`}
        >
          {h.label}
        </button>
      ))}
    </div>
  );
}
