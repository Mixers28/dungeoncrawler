'use client';

import { type GameState } from '../lib/game-schema';
import { ChevronRight, Zap } from 'lucide-react';

interface SpellBookDropdownProps {
  gameState: GameState;
  onSpellCast: (spell: string) => void;
  isProcessing: boolean;
}

/**
 * SpellBookDropdown Component
 * 
 * Lists prepared spells
 * Shows spell slots remaining
 * Allows one-click spell casting
 */
export function SpellBookDropdown({
  gameState,
  onSpellCast,
  isProcessing,
}: SpellBookDropdownProps) {
  if (!gameState.preparedSpells || gameState.preparedSpells.length === 0) {
    return (
      <div className="p-3 text-sm text-slate-500 text-center">
        No prepared spells
      </div>
    );
  }

  // Group spells by assumed level (cantrips first, then higher level)
  const cantrips = gameState.preparedSpells.filter(s => 
    ['fire bolt', 'mage hand', 'ray of frost', 'light', 'prestidigitation', 'acid splash'].some(c => s.toLowerCase().includes(c))
  );
  const otherSpells = gameState.preparedSpells.filter(s => !cantrips.includes(s));

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {/* Cantrips */}
      {cantrips.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2 px-1">Cantrips</div>
          <div className="space-y-1">
            {cantrips.map((spell) => (
              <button
                key={spell}
                onClick={() => onSpellCast(spell.toLowerCase())}
                disabled={isProcessing}
                className="w-full text-left px-3 py-2 rounded text-sm transition-all bg-slate-700 hover:bg-blue-700 text-slate-100 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <div className="font-semibold">{spell}</div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Higher Level Spells */}
      {otherSpells.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2 px-1">Spells</div>
          <div className="space-y-1">
            {otherSpells.map((spell) => {
              const hasSlots = gameState.spellSlots && Object.values(gameState.spellSlots).some(s => s.current > 0);
              return (
                <button
                  key={spell}
                  onClick={() => onSpellCast(spell.toLowerCase())}
                  disabled={isProcessing || !hasSlots}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center justify-between ${
                    hasSlots
                      ? 'bg-slate-700 hover:bg-blue-700 text-slate-100 hover:text-white'
                      : 'bg-slate-700/30 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <div className="font-semibold">{spell}</div>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
