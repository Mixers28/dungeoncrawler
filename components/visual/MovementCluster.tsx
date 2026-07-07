'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface MovementClusterProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
}

export function MovementCluster({ actions, onCommand }: MovementClusterProps) {
  if (actions.length === 0) {
    return <div className="text-xs text-slate-600 italic p-2">No mapped exits from this location.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5" data-testid="movement-cluster">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => onCommand(action.command)}
          disabled={!action.enabled}
          title={action.reason}
          data-testid="movement-action"
          className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
