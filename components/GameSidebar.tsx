'use client';

import { useState } from 'react';
import { GameState } from '../lib/game-schema';
import { Shield, Sword, MapPin, Coins, Scroll, Skull, ImageOff, Heart } from 'lucide-react';

export function GameSidebar({ state }: { state: GameState }) {
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));
  const [imageError, setImageError] = useState(false);

  // Use the image URL provided by the backend library
  const imageUrl = state.currentImage || "";
  const locationTrail = state.locationHistory?.slice(-6) || [];

  return (
    <div className="h-full bg-slate-950 border-l border-slate-800 flex flex-col text-slate-200 overflow-hidden font-sans">
      
      {/* HEADER IMAGE */}
      <div className="relative w-full h-48 bg-slate-900 shrink-0 group overflow-hidden">
        {!imageError && imageUrl ? (
          <img 
            src={imageUrl} 
            alt={state.location}
            className="w-full h-full object-cover opacity-80 transition-opacity duration-700"
            key={imageUrl} 
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center opacity-50">
             <ImageOff className="text-slate-700 mb-6" size={48} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        <div className="absolute bottom-4 left-4 right-4 z-10">
            <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2 drop-shadow-md">
            <MapPin size={20} />
            {state.location}
            </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* PLAYER STATS */}
        <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-800">
             <div className="flex items-center gap-2 text-yellow-500 font-mono font-bold">
                <Coins size={18} />
                <span>{state.gold} GP</span>
            </div>
            <div className="flex items-center gap-2 text-blue-400 text-sm">
                <Shield size={18} />
                <span>AC: <span className="text-white font-mono">{state.ac}</span></span>
            </div>
        </div>

        {/* PLAYER HP */}
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Player Health</span>
                <span>{state.hp} / {state.maxHp}</span>
            </div>
            <div className="w-full bg-slate-800 h-4 rounded overflow-hidden border border-slate-700">
            <div 
                className="bg-red-700 h-full transition-all duration-500 ease-out" 
                style={{ width: `${hpPercent}%` }}
            />
            </div>
        </div>

        {/* CHARACTER INFO */}
        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
          <div className="flex justify-between text-xs text-slate-400 uppercase tracking-widest">
            <span>Class</span>
            <span>Level {state.level}</span>
          </div>
          <div className="text-sm text-amber-300 font-semibold">{state.character?.class || 'Adventurer'}</div>
          <div className="text-xs text-slate-500">{state.character?.background || 'Wanderer'}</div>
          <div className="text-xs text-slate-400">XP: {state.xp} / {state.xpToNext}</div>
        </div>

        {/* LOCATION TRAIL / MINI-MAP */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
            Path
          </h3>
          {locationTrail.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No path recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locationTrail.map((loc, idx) => {
                const isCurrent = idx === locationTrail.length - 1;
                return (
                  <div
                    key={`${loc}-${idx}`}
                    className={`px-2 py-1 rounded border text-xs ${isCurrent ? 'bg-amber-900/40 border-amber-700 text-amber-100' : 'bg-slate-900 border-slate-800 text-slate-300'}`}
                  >
                    {isCurrent ? 'Here: ' : ''}{loc}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* INVENTORY */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                Backpack
            </h3>
            {state.inventory.length === 0 && <p className="text-xs text-slate-600 italic">Empty...</p>}
            <div className="space-y-2">
            {state.inventory.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
                <div className="p-2 bg-slate-950 rounded text-amber-700/80">
                    {item.type === 'weapon' ? <Sword size={16} /> : <Scroll size={16} />}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-slate-300">{item.name}</p>
                    {item.effect && <p className="text-[10px] text-slate-500">{item.effect}</p>}
                </div>
                <span className="text-xs font-mono text-slate-500">x{item.quantity}</span>
                </div>
            ))}
            </div>
        </div>

        {/* NEARBY ENTITIES (With HP Bars) */}
        {state.nearbyEntities.length > 0 && (
            <div className="pt-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    Threats Detected
                </h3>
                <div className="space-y-3">
                {state.nearbyEntities.map((entity, idx) => {
                    const entHpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
                    const isDead = entity.status === 'dead';

                    return (
                        <div key={idx} className={`p-3 rounded border transition-all ${
                            !isDead
                                ? 'bg-red-950/20 border-red-900/40' 
                                : 'bg-slate-900/30 border-slate-800 opacity-60'
                        }`}>
                            {/* Entity Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {isDead ? <Skull size={16} className="text-slate-500"/> : <Heart size={16} className="text-red-500 fill-red-500/20"/>}
                                    <span className={`text-sm font-bold ${isDead ? 'line-through text-slate-500' : 'text-red-200'}`}>
                                        {entity.name}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">
                                    {isDead ? 'DEAD' : `HP ${entity.hp}/${entity.maxHp}`}
                                </span>
                            </div>

                            {/* Entity HP Bar (Only if alive) */}
                            {!isDead && (
                                <div className="w-full bg-red-950 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-red-600 h-full transition-all duration-300" 
                                        style={{ width: `${entHpPercent}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
