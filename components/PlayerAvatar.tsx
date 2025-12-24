'use client';

import { Heart, Shield, Sparkles } from 'lucide-react';

interface PlayerAvatarProps {
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  activeEffects?: Array<{ name: string; type: string }>;
}

/**
 * PlayerAvatar Component
 * 
 * Visual representation of the player character in combat.
 * Shows HP, AC, name, and active status effects.
 */
export function PlayerAvatar({ name, hp, maxHp, ac, activeEffects = [] }: PlayerAvatarProps) {
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  
  // HP color based on percentage
  const getHpColor = () => {
    if (hpPercent > 66) return 'bg-green-500';
    if (hpPercent > 33) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHpGlowColor = () => {
    if (hpPercent > 66) return 'shadow-green-500/50';
    if (hpPercent > 33) return 'shadow-yellow-500/50';
    return 'shadow-red-500/50';
  };

  return (
    <div className="relative">
      {/* Main Card */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-xl border-2 border-amber-700/50 shadow-lg shadow-amber-900/30 p-4 w-72">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">{name}</h3>
              <p className="text-xs text-amber-400">Hero</p>
            </div>
          </div>
          
          {/* AC Badge */}
          <div className="flex items-center gap-1 bg-blue-900/30 border border-blue-700/50 rounded-full px-3 py-1">
            <Shield size={14} className="text-blue-400" />
            <span className="text-sm font-semibold text-blue-100">{ac}</span>
          </div>
        </div>

        {/* HP Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-slate-400">
              <Heart size={12} className="text-red-400" />
              <span>Health</span>
            </div>
            <span className={`font-mono font-semibold ${hpPercent < 25 ? 'text-red-400' : 'text-slate-300'}`}>
              {hp}/{maxHp}
            </span>
          </div>
          <div className="h-3 bg-slate-950/50 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className={`h-full transition-all duration-500 ${getHpColor()} ${getHpGlowColor()} shadow-lg`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Status Effects */}
        {activeEffects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="flex items-center gap-1 mb-2">
              <Sparkles size={12} className="text-purple-400" />
              <span className="text-xs text-slate-400">Active Effects</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeEffects.map((effect, idx) => (
                <span
                  key={idx}
                  className={`text-xs px-2 py-1 rounded-full ${
                    effect.type === 'debuff'
                      ? 'bg-red-900/30 text-red-300 border border-red-800/50'
                      : 'bg-blue-900/30 text-blue-300 border border-blue-800/50'
                  }`}
                >
                  {effect.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Glow Effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent blur-xl -z-10" />
    </div>
  );
}
