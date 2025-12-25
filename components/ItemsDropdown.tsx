'use client';

import { type GameState } from '../lib/game-schema';
import { Package, ChevronRight } from 'lucide-react';

interface ItemsDropdownProps {
  gameState: GameState;
  onItemUse: (item: string) => void;
  isProcessing: boolean;
}

/**
 * ItemsDropdown Component
 * 
 * Lists consumable items (potions, scrolls, food)
 * Shows quantity
 * Allows one-click item use
 */
export function ItemsDropdown({
  gameState,
  onItemUse,
  isProcessing,
}: ItemsDropdownProps) {
  // Filter consumable items
  const consumables = gameState.inventory.filter(
    i => ['potion', 'scroll', 'food'].includes(i.type)
  );

  if (consumables.length === 0) {
    return (
      <div className="p-3 text-sm text-slate-500 text-center">
        No consumable items
      </div>
    );
  }

  // Group by type
  const itemsByType: Record<string, typeof consumables> = {};
  consumables.forEach(item => {
    if (!itemsByType[item.type]) itemsByType[item.type] = [];
    itemsByType[item.type].push(item);
  });

  const typeLabels: Record<string, string> = {
    potion: 'Potions',
    scroll: 'Scrolls',
    food: 'Food & Provisions',
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {Object.entries(itemsByType).map(([type, items]) => (
        <div key={type}>
          {/* Type Header */}
          <div className="text-xs font-semibold text-slate-400 mb-2 px-1">
            {typeLabels[type]}
          </div>

          {/* Items List */}
          <div className="space-y-1">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onItemUse(item.name.toLowerCase())}
                disabled={isProcessing}
                className="w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center justify-between bg-slate-700 hover:bg-green-700 text-slate-100 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex-1">
                  <div className="font-semibold">{item.name}</div>
                  {item.effect && (
                    <div className="text-xs text-slate-400">{item.effect}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {item.quantity > 1 && (
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                      ×{item.quantity}
                    </span>
                  )}
                  <ChevronRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
