'use client';

import { type Entity } from '../lib/game-schema';
import { MonsterCard } from './MonsterCard';
import { PlayerAvatar } from './PlayerAvatar';
import { Swords } from 'lucide-react';

interface BattlefieldViewProps {
  entities: Entity[];
  playerHp: number;
  playerMaxHp: number;
  playerAc: number;
  playerName: string;
  onEntityClick?: (entity: Entity) => void;
  isCombatActive: boolean;
  isProcessing?: boolean;
}

/**
 * BattlefieldView Component
 * 
 * Visual representation of combat encounters with grid-based positioning.
 * Shows player avatar and monster cards with HP bars and status effects.
 */
export function BattlefieldView({
  entities,
  playerHp,
  playerMaxHp,
  playerAc,
  playerName,
  onEntityClick,
  isCombatActive,
  isProcessing = false,
}: BattlefieldViewProps) {
  const aliveMonsters = entities.filter(e => e.status === 'alive');
  const deadMonsters = entities.filter(e => e.status === 'dead');
  
  // If no combat, show empty state
  if (!isCombatActive || aliveMonsters.length === 0) {
    return (
      <div className="w-full h-64 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Swords size={48} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active threats</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg border border-amber-900/30 shadow-lg overflow-hidden">
      {/* Battlefield Header */}
      <div className="bg-slate-950/50 border-b border-amber-900/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords size={18} className="text-amber-500" />
          <span className="text-sm font-semibold text-amber-100">Battlefield</span>
        </div>
        <div className="text-xs text-slate-400">
          {aliveMonsters.length} {aliveMonsters.length === 1 ? 'enemy' : 'enemies'}
        </div>
      </div>

      {/* Battle Grid */}
      <div className="p-6 min-h-64">
        {/* Player Section */}
        <div className="mb-6 flex justify-center">
          <PlayerAvatar
            name={playerName}
            hp={playerHp}
            maxHp={playerMaxHp}
            ac={playerAc}
          />
        </div>

        {/* VS Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-amber-900/30"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900 px-3 text-amber-500 font-semibold">VS</span>
          </div>
        </div>

        {/* Monster Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aliveMonsters.map((entity, idx) => (
            <MonsterCard
              key={`${entity.name}-${entity.hp}-${idx}`}
              entity={entity}
              onClick={() => onEntityClick?.(entity)}
              disabled={false}
            />
          ))}
        </div>

        {/* Dead Monsters (Faded) */}
        {deadMonsters.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-600 mb-3 uppercase tracking-wide">Defeated</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {deadMonsters.map((entity, idx) => (
                <div
                  key={`dead-${entity.name}-${idx}`}
                  className="text-xs text-slate-700 flex items-center gap-1 opacity-50"
                >
                  <span className="text-slate-800">💀</span>
                  <span className="truncate">{entity.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
