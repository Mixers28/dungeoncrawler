'use client';

import type { VisualPartySlot } from '../../lib/visual/view-model';

interface PartyRailProps {
  slots: VisualPartySlot[];
}

export function PartyRail({ slots }: PartyRailProps) {
  return (
    <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0" data-testid="party-rail">
      {slots.map(slot => {
        const hpPct = Math.max(0, Math.min(100, (slot.hp / Math.max(1, slot.maxHp)) * 100));
        return (
          <div
            key={slot.playerId}
            className={`flex-shrink-0 w-40 md:w-full rounded border p-2 text-xs transition-colors ${
              slot.isActiveTurn ? 'border-amber-500 bg-amber-900/20' : 'border-slate-800 bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-amber-400 truncate">{slot.displayName}</span>
              {slot.isYou && <span className="text-[10px] text-slate-500 flex-shrink-0">YOU</span>}
            </div>
            <div className="text-slate-400 truncate">{slot.className}</div>
            <div className="mt-1 h-1.5 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-red-600" style={{ width: `${hpPct}%` }} />
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
