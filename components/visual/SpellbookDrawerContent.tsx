'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface SpellbookDrawerContentProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
}

export function SpellbookDrawerContent({ actions, onCommand }: SpellbookDrawerContentProps) {
  if (actions.length === 0) {
    return <div className="text-sm text-slate-600 italic">No known spells.</div>;
  }

  return (
    <div className="space-y-1.5" data-testid="spell-actions">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => onCommand(action.command)}
          disabled={!action.enabled}
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
      ))}
    </div>
  );
}
