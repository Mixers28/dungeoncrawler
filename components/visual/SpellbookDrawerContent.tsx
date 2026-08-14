'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface SpellbookDrawerContentProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
  disabled: boolean;
  disabledReason?: string;
  spellSlots: Record<string, { max: number; current: number }>;
}

export function SpellbookDrawerContent({ actions, onCommand, disabled, disabledReason, spellSlots }: SpellbookDrawerContentProps) {
  if (actions.length === 0) {
    return <div className="text-sm text-slate-600 italic">No known spells.</div>;
  }

  const slotEntries = Object.entries(spellSlots || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      {/* The drawer covers the shell's turn-state strip, so it has to restate
          why nothing in here can be cast. */}
      {disabled && disabledReason && (
        <div className="text-xs text-amber-500 border border-amber-900/50 bg-amber-950/30 rounded px-3 py-2 mb-2" data-testid="drawer-status">
          {disabledReason}
        </div>
      )}
      {/* Remaining slots drive whether a leveled spell can be cast at all, so
          the drawer states them instead of leaving the counts to text mode. */}
      {slotEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2 mb-2 border-b border-slate-800" data-testid="spell-slot-summary">
          {slotEntries.map(([key, slot]) => (
            <span
              key={key}
              className="text-[10px] px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300"
            >
              {key.replace('_', ' ')} {slot.current}/{slot.max}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5" data-testid="spell-actions">
      {actions.map(action => {
        const isDisabled = disabled || !action.enabled;
        return (
        <div key={action.id}>
        <button
          onClick={() => onCommand(action.command)}
          disabled={isDisabled}
          title={action.reason}
          className="w-full flex items-center gap-2 text-left px-3 py-2 rounded text-sm bg-slate-800 hover:bg-blue-800/60 border border-slate-700 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {action.imagePath && (
            <img
              src={action.imagePath}
              alt=""
              className="w-6 h-6 rounded bg-slate-900 border border-slate-700 object-contain flex-shrink-0"
            />
          )}
          <span className="truncate flex-1">{action.label}</span>
          {action.statusLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded border border-slate-600 bg-slate-900 text-slate-300 flex-shrink-0">
              {action.statusLabel}
            </span>
          )}
        </button>
        {/* Slot/preparation reasons are the whole point of the disabled state,
            so they must be readable without hovering. */}
        {isDisabled && action.reason && (
          <span className="block text-[10px] leading-tight text-amber-500/90 mt-0.5 pl-1">{action.reason}</span>
        )}
        </div>
        );
      })}
      </div>
    </>
  );
}
