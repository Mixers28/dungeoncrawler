'use client';

import { useState } from 'react';
import { type Entity } from '../lib/game-schema';
import { Shield, Sword, Heart, Skull, ImageOff } from 'lucide-react';

interface MonsterCardProps {
  entity: Entity;
  onClick?: () => void;
}

/**
 * MonsterCard Component
 * 
 * Visual card for individual monsters showing:
 * - Monster image with fallback
 * - HP bar with percentage
 * - AC and attack stats
 * - Status effects
 * - Click interaction for targeting
 */
export function MonsterCard({ entity, onClick }: MonsterCardProps) {
  const [imageError, setImageError] = useState(false);
  
  const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
  const isAlive = entity.status === 'alive';
  const isDead = entity.status === 'dead';
  
  // HP color based on percentage
  const getHpColor = () => {
    if (hpPercent > 66) return 'bg-green-500';
    if (hpPercent > 33) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <button
      onClick={onClick}
      disabled={!isAlive}
      className={`
        relative group rounded-lg border overflow-hidden transition-all duration-200
        ${isAlive 
          ? 'bg-slate-800/80 border-slate-700 hover:border-amber-700 hover:shadow-lg hover:shadow-amber-900/20 hover:scale-105 cursor-pointer' 
          : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'}
      `}
    >
      {/* Monster Image */}
      <div className="relative h-32 bg-slate-900/50 overflow-hidden">
        {entity.imageUrl && !imageError ? (
          <img
            src={entity.imageUrl}
            alt={entity.name}
            className={`w-full h-full object-cover transition-all duration-200 ${
              isAlive ? 'group-hover:scale-110' : 'grayscale opacity-40'
            }`}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="text-slate-700" size={32} />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
        
        {/* Status Badge */}
        {isDead && (
          <div className="absolute top-2 right-2 bg-red-900/90 text-red-100 text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Skull size={12} />
            <span>Defeated</span>
          </div>
        )}
      </div>

      {/* Monster Info */}
      <div className="p-3 space-y-2">
        {/* Name */}
        <h3 className="font-semibold text-sm text-slate-100 truncate">
          {entity.name}
        </h3>

        {/* HP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-slate-400">
              <Heart size={12} />
              <span>HP</span>
            </div>
            <span className={`font-mono ${hpPercent < 25 ? 'text-red-400' : 'text-slate-300'}`}>
              {entity.hp}/{entity.maxHp}
            </span>
          </div>
          <div className="h-2 bg-slate-900/50 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getHpColor()}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Shield size={12} className="text-blue-400" />
            <span className="text-slate-300">{entity.ac}</span>
          </div>
          <div className="flex items-center gap-1">
            <Sword size={12} className="text-red-400" />
            <span className="text-slate-300">+{entity.attackBonus}</span>
          </div>
          <span className="text-slate-500">{entity.damageDice}</span>
        </div>

        {/* Status Effects */}
        {entity.effects && entity.effects.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {entity.effects.map((effect, idx) => (
              <span
                key={idx}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  effect.type === 'debuff'
                    ? 'bg-red-900/30 text-red-300 border border-red-800/50'
                    : 'bg-blue-900/30 text-blue-300 border border-blue-800/50'
                }`}
              >
                {effect.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover Indicator */}
      {isAlive && (
        <div className="absolute inset-0 border-2 border-amber-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </button>
  );
}
