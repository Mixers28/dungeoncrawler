'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface ActionTrayProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
  onInventoryOpen: () => void;
  inventoryDisabled: boolean;
}

export function ActionTray({ actions, onCommand, onInventoryOpen, inventoryDisabled }: ActionTrayProps) {
  return (
    <div className="flex flex-wrap gap-1.5 content-start">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => onCommand(action.command)}
          disabled={!action.enabled}
          title={action.reason}
          className="text-xs font-semibold bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700 text-amber-300 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {action.label}
        </button>
      ))}
      <button
        onClick={onInventoryOpen}
        disabled={inventoryDisabled}
        className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Inventory
      </button>
    </div>
  );
}
