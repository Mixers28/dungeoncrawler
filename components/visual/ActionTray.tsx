'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface ActionTrayProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
  onInventoryOpen: () => void;
  onSpellbookOpen: () => void;
  onLogOpen: () => void;
  disabled: boolean;
}

export function ActionTray({ actions, onCommand, onInventoryOpen, onSpellbookOpen, onLogOpen, disabled }: ActionTrayProps) {
  return (
    <div className="flex flex-wrap gap-1.5 content-start" data-testid="action-tray">
      {actions.map(action => {
        const isDisabled = disabled || !action.enabled;
        return (
          <div key={action.id} className="flex flex-col max-w-[11rem]">
            <button
              onClick={() => onCommand(action.command)}
              disabled={isDisabled}
              title={action.reason}
              data-testid="exploration-combat-action"
              className="text-xs font-semibold bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700 text-amber-300 px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {action.label}
            </button>
            {/* Reason must be readable without hover: touch and keyboard users
                never see a title tooltip. */}
            {isDisabled && action.reason && (
              <span className="text-[10px] leading-tight text-amber-500/90 mt-0.5">{action.reason}</span>
            )}
          </div>
        );
      })}
      {/* Drawer-open buttons stay enabled even when the player cannot act:
          waiting players may inspect inventory/spells/log, and the command
          buttons inside each drawer carry their own disabled state. */}
      <button
        onClick={onInventoryOpen}
        data-testid="open-inventory-drawer"
        className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded transition-colors"
      >
        Inventory
      </button>
      <button
        onClick={onSpellbookOpen}
        data-testid="open-spellbook-drawer"
        className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded transition-colors"
      >
        Spells
      </button>
      <button
        onClick={onLogOpen}
        data-testid="open-log-drawer"
        className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded transition-colors"
      >
        Log
      </button>
    </div>
  );
}
