'use client';

import type { GameState } from '../lib/game-schema';
import { Dice6 } from 'lucide-react';

function formatHitMiss(value: boolean | null) {
  if (value === null) return null;
  return value ? 'HIT' : 'MISS';
}

export function DiceTray({ state, variant = 'full' }: { state: GameState; variant?: 'full' | 'compact' }) {
  const rolls = state.lastRolls;
  const hasAnyRoll =
    (rolls?.playerAttack || 0) > 0 ||
    (rolls?.playerDamage || 0) > 0 ||
    (rolls?.monsterAttack || 0) > 0 ||
    (rolls?.monsterDamage || 0) > 0;

  if (!hasAnyRoll) return null;

  const aliveThreat = state.nearbyEntities?.find(e => e.status !== 'dead');
  const playerHit = aliveThreat ? (rolls.playerAttack || 0) >= aliveThreat.ac : null;

  const effectivePlayerAc = (state.ac || 0) + (state.tempAcBonus || 0);
  const monsterHit = (rolls.monsterAttack || 0) >= effectivePlayerAc;

  const playerHitLabel = formatHitMiss(playerHit);
  const monsterHitLabel = formatHitMiss(monsterHit);

  const isCompact = variant === 'compact';

  if (isCompact) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-900/50 border border-slate-800 rounded p-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">You</div>
          <div className="text-[11px] text-slate-300 flex justify-between">
            <span>A</span>
            <span className="font-mono text-slate-200">
              {rolls.playerAttack || 0}
              {aliveThreat ? ` vs ${aliveThreat.ac}` : ''}
              {playerHitLabel ? ` ${playerHitLabel}` : ''}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 flex justify-between">
            <span>D</span>
            <span className="font-mono text-slate-200">{rolls.playerDamage || 0}</span>
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded p-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Enemy</div>
          <div className="text-[11px] text-slate-300 flex justify-between">
            <span>A</span>
            <span className="font-mono text-slate-200">
              {rolls.monsterAttack || 0} vs {effectivePlayerAc}
              {monsterHitLabel ? ` ${monsterHitLabel}` : ''}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 flex justify-between">
            <span>D</span>
            <span className="font-mono text-slate-200">{rolls.monsterDamage || 0}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
        <Dice6 size={14} />
        Dice Tray
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-slate-900/50 border border-slate-800 rounded p-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">You</div>
          <div className="text-xs text-slate-300 flex justify-between">
            <span>Attack</span>
            <span className="font-mono text-slate-200">
              {rolls.playerAttack || 0}
              {aliveThreat ? ` vs AC ${aliveThreat.ac}` : ''}
              {playerHitLabel ? ` (${playerHitLabel})` : ''}
            </span>
          </div>
          <div className="text-xs text-slate-300 flex justify-between">
            <span>Damage</span>
            <span className="font-mono text-slate-200">{rolls.playerDamage || 0}</span>
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded p-2">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Enemy</div>
          <div className="text-xs text-slate-300 flex justify-between">
            <span>Attack</span>
            <span className="font-mono text-slate-200">
              {rolls.monsterAttack || 0} vs AC {effectivePlayerAc}
              {monsterHitLabel ? ` (${monsterHitLabel})` : ''}
            </span>
          </div>
          <div className="text-xs text-slate-300 flex justify-between">
            <span>Damage</span>
            <span className="font-mono text-slate-200">{rolls.monsterDamage || 0}</span>
          </div>
        </div>
      </div>
      {aliveThreat && (
        <div className="text-[11px] text-slate-500">
          Target guess: <span className="text-slate-300">{aliveThreat.name}</span>
        </div>
      )}
    </div>
  );
}
