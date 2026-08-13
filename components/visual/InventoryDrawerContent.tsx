'use client';

import type { VisualAction } from '../../lib/visual/view-model';

interface InventoryDrawerContentProps {
  actions: VisualAction[];
  onCommand: (command: string) => void;
  onOpenFullInventory: () => void;
  disabled: boolean;
  disabledReason?: string;
}

export function InventoryDrawerContent({ actions, onCommand, onOpenFullInventory, disabled, disabledReason }: InventoryDrawerContentProps) {
  return (
    <div className="space-y-3">
      {/* The drawer covers the shell's turn-state strip, so it has to restate
          why nothing in here can be used. */}
      {disabled && disabledReason && (
        <div className="text-xs text-amber-500 border border-amber-900/50 bg-amber-950/30 rounded px-3 py-2" data-testid="drawer-status">
          {disabledReason}
        </div>
      )}
      <button
        onClick={onOpenFullInventory}
        className="w-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded transition-colors"
      >
        Manage Full Inventory (equip / drop)
      </button>

      <div className="text-xs font-semibold text-slate-400 pt-1">Quick Use</div>
      {actions.length === 0 ? (
        <div className="text-sm text-slate-600 italic">No usable items.</div>
      ) : (
        <div className="space-y-1.5" data-testid="quick-use-actions">
          {actions.map(action => {
            const isDisabled = disabled || !action.enabled;
            return (
            <div key={action.id}>
            <button
              onClick={() => onCommand(action.command)}
              disabled={isDisabled}
              title={action.reason}
              className="w-full flex items-center gap-2 text-left px-3 py-2 rounded text-sm bg-slate-800 hover:bg-green-800/60 border border-slate-700 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {action.imagePath && (
                <img
                  src={action.imagePath}
                  alt=""
                  className="w-6 h-6 rounded bg-slate-900 border border-slate-700 object-contain flex-shrink-0"
                />
              )}
              <span className="truncate">{action.label}</span>
            </button>
            {isDisabled && action.reason && (
              <span className="block text-[10px] leading-tight text-amber-500/90 mt-0.5 pl-1">{action.reason}</span>
            )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
