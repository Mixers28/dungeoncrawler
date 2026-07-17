'use client';

import { useState } from 'react';
import type { VisualPartySlot } from '../../lib/visual/view-model';

interface PartyRailProps {
  slots: VisualPartySlot[];
}

type FloatingNumber = { key: string; amount: number; kind: 'damage' | 'heal' };

export function PartyRail({ slots }: PartyRailProps) {
  const [prevHp, setPrevHp] = useState<Map<string, number>>(new Map());
  const [floatingBySlot, setFloatingBySlot] = useState<Map<string, FloatingNumber>>(new Map());

  // Adjust state during render (React-sanctioned pattern) instead of an effect:
  // detect HP changes against the last-seen snapshot and queue floating combat numbers.
  const hpChanged = slots.some(slot => prevHp.get(slot.playerId) !== slot.hp);
  if (hpChanged) {
    const nextPrevHp = new Map(prevHp);
    const updates = new Map<string, FloatingNumber>();
    for (const slot of slots) {
      const prev = prevHp.get(slot.playerId);
      if (prev !== undefined && slot.hp !== prev) {
        updates.set(slot.playerId, {
          key: `${slot.playerId}:${slot.hp}`,
          amount: Math.abs(slot.hp - prev),
          kind: slot.hp < prev ? 'damage' : 'heal',
        });
      }
      nextPrevHp.set(slot.playerId, slot.hp);
    }
    setPrevHp(nextPrevHp);
    if (updates.size > 0) {
      setFloatingBySlot(current => {
        const next = new Map(current);
        updates.forEach((value, id) => next.set(id, value));
        return next;
      });
    }
  }

  function clearFloating(playerId: string) {
    setFloatingBySlot(current => {
      if (!current.has(playerId)) return current;
      const next = new Map(current);
      next.delete(playerId);
      return next;
    });
  }

  return (
    <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0" data-testid="party-rail">
      {slots.map(slot => {
        const hpPct = Math.max(0, Math.min(100, (slot.hp / Math.max(1, slot.maxHp)) * 100));
        const floating = floatingBySlot.get(slot.playerId);
        return (
          <div
            key={slot.playerId}
            className={`relative flex-shrink-0 w-40 md:w-full rounded border p-2 text-xs transition-colors ${
              slot.isActiveTurn ? 'border-amber-500 bg-amber-900/20' : 'border-slate-800 bg-slate-900'
            } ${floating?.kind === 'damage' ? 'animate-shake-frame' : ''}`}
          >
            {floating && (
              <span
                key={floating.key}
                onAnimationEnd={() => clearFloating(slot.playerId)}
                className={`floating-combat-number absolute top-1 left-1/2 text-sm font-extrabold drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${floating.kind === 'damage' ? 'text-red-400' : 'text-green-400'}`}
              >
                {floating.kind === 'damage' ? '-' : '+'}{floating.amount}
              </span>
            )}
            <div className="flex items-center gap-2">
              {slot.portraitPath && (
                <img
                  src={slot.portraitPath}
                  alt=""
                  className={`w-8 h-8 rounded object-cover flex-shrink-0 border border-slate-700 transition-[filter] ${
                    floating?.kind === 'damage' ? 'animate-hit-flash' : floating?.kind === 'heal' ? 'animate-heal-flash' : ''
                  }`}
                />
              )}
              <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                <span className="font-bold text-amber-400 truncate">{slot.displayName}</span>
                {slot.isYou && <span className="text-[10px] text-slate-500 flex-shrink-0">YOU</span>}
              </div>
            </div>
            <div className="text-slate-400 truncate">{slot.className}</div>
            <div className="mt-1 h-1.5 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-red-600 transition-[width] duration-300" style={{ width: `${hpPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>{slot.hp}/{slot.maxHp} HP</span>
              <span>AC {slot.ac}</span>
            </div>
            {slot.conditions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {slot.conditions.map(condition => (
                  <span key={condition} className="text-[10px] px-1 rounded bg-purple-900/40 text-purple-300">
                    {condition}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
