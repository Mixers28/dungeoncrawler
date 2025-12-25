'use client';

import { type GameState } from '../lib/game-schema';
import { Sword, CheckCircle2, ChevronRight } from 'lucide-react';

interface WeaponDropdownProps {
  gameState: GameState;
  onWeaponAttack: (weapon?: string) => void;
  onWeaponEquip: (weaponId: string) => void;
  isProcessing: boolean;
}

/**
 * WeaponDropdown Component
 * 
 * Lists available weapons in inventory
 * Shows equipped indicator
 * Allows quick attack or weapon switching
 */
export function WeaponDropdown({
  gameState,
  onWeaponAttack,
  onWeaponEquip,
  isProcessing,
}: WeaponDropdownProps) {
  const weapons = gameState.inventory.filter(i => i.type === 'weapon');
  const equippedWeapon = weapons.find(w => w.equipped);

  if (weapons.length === 0) {
    return (
      <div className="p-3 text-sm text-slate-500 text-center">
        No weapons in inventory
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {/* Equipped Indicator */}
      {equippedWeapon && (
        <div className="px-3 py-2 bg-slate-700 rounded border border-orange-600/50 text-sm">
          <div className="text-xs text-slate-400 mb-1">Currently Equipped</div>
          <div className="font-semibold text-orange-300">{equippedWeapon.name}</div>
        </div>
      )}

      {/* Quick Attack Button */}
      <button
        onClick={() => onWeaponAttack()}
        disabled={isProcessing}
        className="w-full px-3 py-2 bg-orange-700 hover:bg-orange-600 text-white font-semibold rounded text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Sword size={16} />
        Attack with {equippedWeapon?.name || 'Unarmed Strike'}
      </button>

      {/* Weapons List */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-400 px-1">Switch Weapon</div>
        {weapons.map((weapon) => (
          <div key={weapon.id} className="flex items-stretch gap-1">
            <button
              onClick={() => onWeaponAttack(weapon.name.toLowerCase())}
              disabled={isProcessing || weapon.equipped}
              className={`flex-1 text-left px-3 py-2 rounded text-sm transition-all ${
                weapon.equipped
                  ? 'bg-slate-700/30 text-slate-600 cursor-default'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
              }`}
              title="Attack with this weapon"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{weapon.name}</div>
                  {weapon.effect && (
                    <div className="text-xs text-slate-400">{weapon.effect}</div>
                  )}
                </div>
                <ChevronRight size={14} className="ml-1" />
              </div>
            </button>
            {weapon.equipped && (
              <div className="px-2 flex items-center text-orange-400">
                <CheckCircle2 size={16} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
