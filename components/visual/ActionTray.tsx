'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface ActionTrayProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
  onInventoryOpen: () => void;
  onSpellbookOpen: () => void;
  disabled: boolean;
}

export function ActionTray({ actions, onCommand, onInventoryOpen, onSpellbookOpen, disabled }: ActionTrayProps) {
  return (
    <div className="flex flex-wrap gap-1.5 content-start" data-testid="action-tray">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => onCommand(action.command)}
          disabled={!action.enabled}
          title={action.reason}
          data-testid="exploration-combat-action"
          className="text-xs font-semibold bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700 text-amber-300 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {action.label}
        </button>
      ))}
      <button
        onClick={onInventoryOpen}
        disabled={disabled}
        data-testid="open-inventory-drawer"
        className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Inventory
      </button>
      <button
        onClick={onSpellbookOpen}
        disabled={disabled}
        data-testid="open-spellbook-drawer"
        className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Spells
      </button>
    </div>
  );
}
