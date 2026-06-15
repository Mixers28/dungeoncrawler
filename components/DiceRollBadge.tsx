'use client';

import type { RollEvent } from '../lib/game-schema';

const outcomeStyles: Record<RollEvent['outcome'], string> = {
  hit:  'border-green-700 bg-green-950/70 text-green-300',
  crit: 'border-yellow-500 bg-yellow-950/70 text-yellow-200',
  miss: 'border-slate-600 bg-slate-900/60 text-slate-400',
};

const outcomeLabel: Record<RollEvent['outcome'], string> = {
  hit:  'HIT',
  crit: 'CRIT!',
  miss: 'MISS',
};

function DiceRollBadge({ roll }: { roll: RollEvent }) {
  const sign = roll.modifier >= 0 ? '+' : '';
  const style = outcomeStyles[roll.outcome];
  const label = outcomeLabel[roll.outcome];

  return (
    <div className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border ${style}`}>
      <span className="opacity-60 text-[10px]">{roll.label}</span>
      <span className="opacity-40 mx-0.5">|</span>
      <span className="font-bold">🎲{roll.d20}</span>
      {roll.modifier !== 0 && (
        <span className="opacity-70">{sign}{roll.modifier}</span>
      )}
      <span className="opacity-50">=</span>
      <span className="font-bold">{roll.total}</span>
      <span className="opacity-50 text-[10px]">vs {roll.against}</span>
      <span className="opacity-40 mx-0.5">→</span>
      <span className={`font-bold text-[10px] tracking-wider ${roll.outcome === 'miss' ? 'text-slate-500' : roll.outcome === 'crit' ? 'text-yellow-300' : 'text-green-400'}`}>
        {label}
      </span>
      {roll.damage !== undefined && (
        <span className="opacity-60 ml-0.5">({roll.damage} dmg)</span>
      )}
    </div>
  );
}

export function DiceRollRow({ rolls }: { rolls: RollEvent[] }) {
  if (rolls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-700/50">
      {rolls.map((r, i) => (
        <DiceRollBadge key={i} roll={r} />
      ))}
    </div>
  );
}
