'use client';

import { useState } from 'react';
import { type GameState } from '../lib/game-schema';
import { Heart, Shield, Zap, Sword, Package, X } from 'lucide-react';

interface VisualGameBarProps {
  gameState: GameState;
  onInventoryOpen: () => void;
  isProcessing: boolean;
}

/**
 * VisualGameBar Component
 * 
 * Top combat UI bar showing:
 * - Character stats (HP, AC, Level)
 * - Spell slots remaining
 * - Active effects
 * - Quick action menus (spells, weapons, items)
 * - Inventory button
 */
export function VisualGameBar({
  gameState,
  onInventoryOpen,
  isProcessing,
}: VisualGameBarProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  
  const hpPercent = (gameState.hp / gameState.maxHp) * 100;
  const xpPercent = (gameState.xp / gameState.xpToNext) * 100;
  
  // Get spell slot summary
  const spellSlotSummary = gameState.spellSlots
    ? Object.entries(gameState.spellSlots)
        .filter(([_, data]) => data.max > 0)
        .map(([level, data]) => `${level.replace('_', ' ')}: ${data.current}/${data.max}`)
        .join(' • ')
    : '';

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
      {/* Top Row: Character Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* HP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1 text-red-400">
              <Heart size={14} /> HP
            </span>
            <span className="text-slate-300">{gameState.hp}/{gameState.maxHp}</span>
          </div>
          <div className="w-full h-6 bg-slate-800 rounded border border-slate-700 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 flex items-center justify-center text-xs font-bold ${
                hpPercent > 50 ? 'bg-green-600' : hpPercent > 25 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${Math.max(hpPercent, 5)}%` }}
            >
              {hpPercent > 20 && <span className="text-white drop-shadow">{Math.round(hpPercent)}%</span>}
            </div>
          </div>
        </div>

        {/* AC */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-blue-400 flex items-center gap-1">
            <Shield size={14} /> AC
          </div>
          <div className="text-lg font-bold text-slate-200">{gameState.ac}</div>
        </div>

        {/* Level & XP */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-amber-400">Level {gameState.level}</div>
          <div className="w-full h-4 bg-slate-800 rounded border border-slate-700 overflow-hidden">
            <div
              className="h-full bg-amber-600 transition-all duration-300"
              style={{ width: `${Math.max(xpPercent, 5)}%` }}
            />
          </div>
        </div>

        {/* Gold */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-yellow-500">Gold</div>
          <div className="text-lg font-bold text-slate-200">{gameState.gold}</div>
        </div>
      </div>

      {/* Spell Slots (if casting class) */}
      {spellSlotSummary && (
        <div className="text-xs text-slate-400 p-2 bg-slate-800 rounded border border-slate-700">
          <span className="flex items-center gap-1 font-semibold text-blue-400 mb-1">
            <Zap size={12} /> Spell Slots
          </span>
          {spellSlotSummary}
        </div>
      )}

      {/* Active Effects */}
      {gameState.activeEffects && gameState.activeEffects.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400">Active Effects</div>
          <div className="flex flex-wrap gap-2">
            {gameState.activeEffects.slice(0, 6).map((effect, idx) => (
              <div
                key={idx}
                className="text-xs px-2 py-1 rounded border bg-slate-800 border-slate-700 text-slate-300"
              >
                {effect.name}
                {effect.expiresAtTurn && (
                  <span className="text-slate-500 ml-1">
                    ({Math.max(0, effect.expiresAtTurn - (gameState.turnCounter || 0))}t)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Spells Button */}
        <button
          onClick={() => setExpandedMenu(expandedMenu === 'spells' ? null : 'spells')}
          disabled={isProcessing || (gameState.knownSpells?.length || 0) === 0}
          className={`relative py-2 px-3 rounded font-semibold text-sm flex items-center justify-center gap-1 transition-all ${
            expandedMenu === 'spells'
              ? 'bg-blue-600 border border-blue-500 text-white'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <Zap size={16} />
          <span className="hidden sm:inline">Spells</span>
        </button>

        {/* Weapons Button */}
        <button
          onClick={() => setExpandedMenu(expandedMenu === 'weapons' ? null : 'weapons')}
          disabled={isProcessing}
          className={`relative py-2 px-3 rounded font-semibold text-sm flex items-center justify-center gap-1 transition-all ${
            expandedMenu === 'weapons'
              ? 'bg-orange-600 border border-orange-500 text-white'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:border-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <Sword size={16} />
          <span className="hidden sm:inline">Weapons</span>
        </button>

        {/* Items Button */}
        <button
          onClick={() => setExpandedMenu(expandedMenu === 'items' ? null : 'items')}
          disabled={isProcessing || gameState.inventory.filter(i => ['potion', 'scroll', 'food'].includes(i.type)).length === 0}
          className={`relative py-2 px-3 rounded font-semibold text-sm flex items-center justify-center gap-1 transition-all ${
            expandedMenu === 'items'
              ? 'bg-green-600 border border-green-500 text-white'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:border-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <Package size={16} />
          <span className="hidden sm:inline">Items</span>
        </button>

        {/* Inventory Button */}
        <button
          onClick={onInventoryOpen}
          disabled={isProcessing}
          className="py-2 px-3 rounded font-semibold text-sm flex items-center justify-center gap-1 bg-slate-800 border border-slate-700 text-slate-200 hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Package size={16} />
          <span className="hidden sm:inline">Backpack</span>
        </button>
      </div>

      {/* Menu Placeholder (dropdowns will be implemented in Phase 3-5) */}
      {expandedMenu && (
        <div className="p-3 bg-slate-800 border border-slate-700 rounded space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300 capitalize">{expandedMenu}</span>
            <button
              onClick={() => setExpandedMenu(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
          <div className="text-xs text-slate-500 p-2 bg-slate-900 rounded">
            [{expandedMenu} dropdown coming in next phase]
          </div>
        </div>
      )}
    </div>
  );
}
