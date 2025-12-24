'use client';

import { Sword, Wand2, Package, Flag, Loader2 } from 'lucide-react';

interface ActionBarProps {
  onAction: (action: string) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  canCastSpell?: boolean;
  hasItems?: boolean;
}

/**
 * ActionBar Component
 * 
 * Quick action buttons for combat:
 * - Attack: Basic melee/ranged attack
 * - Cast: Spell casting
 * - Item: Use consumable item
 * - Run: Attempt to flee combat
 */
export function ActionBar({
  onAction,
  disabled = false,
  isProcessing = false,
  canCastSpell = false,
  hasItems = false,
}: ActionBarProps) {
  const handleAction = (action: string) => {
    if (disabled || isProcessing) return;
    onAction(action);
  };

  const buttonClass = (isDisabled: boolean) => `
    relative flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm
    transition-all duration-200
    ${isDisabled 
      ? 'bg-slate-800/50 border border-slate-700/50 text-slate-600 cursor-not-allowed' 
      : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-slate-100 hover:from-slate-600 hover:to-slate-700 hover:border-amber-600 hover:shadow-lg hover:shadow-amber-900/20 hover:scale-105 active:scale-95 cursor-pointer'}
  `;

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-amber-900/30 rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-100 flex items-center gap-2">
          <Sword size={16} className="text-amber-500" />
          Combat Actions
        </h3>
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Loader2 size={14} className="animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Attack */}
        <button
          onClick={() => handleAction('attack')}
          disabled={disabled || isProcessing}
          className={buttonClass(disabled || isProcessing)}
          title="Attack the enemy (A)"
        >
          <Sword size={18} className="text-red-400" />
          <span>Attack</span>
          <kbd className="absolute top-1 right-1 text-xs bg-slate-950/50 px-1 rounded opacity-50">A</kbd>
        </button>

        {/* Cast Spell */}
        <button
          onClick={() => handleAction('cast')}
          disabled={disabled || isProcessing || !canCastSpell}
          className={buttonClass(disabled || isProcessing || !canCastSpell)}
          title={canCastSpell ? "Cast a spell (C)" : "No spells available"}
        >
          <Wand2 size={18} className="text-purple-400" />
          <span>Cast</span>
          <kbd className="absolute top-1 right-1 text-xs bg-slate-950/50 px-1 rounded opacity-50">C</kbd>
        </button>

        {/* Use Item */}
        <button
          onClick={() => handleAction('item')}
          disabled={disabled || isProcessing || !hasItems}
          className={buttonClass(disabled || isProcessing || !hasItems)}
          title={hasItems ? "Use an item (I)" : "No items available"}
        >
          <Package size={18} className="text-green-400" />
          <span>Item</span>
          <kbd className="absolute top-1 right-1 text-xs bg-slate-950/50 px-1 rounded opacity-50">I</kbd>
        </button>

        {/* Run */}
        <button
          onClick={() => handleAction('run')}
          disabled={disabled || isProcessing}
          className={buttonClass(disabled || isProcessing)}
          title="Attempt to flee (R)"
        >
          <Flag size={18} className="text-yellow-400" />
          <span>Run</span>
          <kbd className="absolute top-1 right-1 text-xs bg-slate-950/50 px-1 rounded opacity-50">R</kbd>
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-slate-500 mt-3 text-center">
        Use keyboard shortcuts or click to perform actions
      </p>
    </div>
  );
}
