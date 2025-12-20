'use client';

import { useState } from 'react';
import { GameState } from '../lib/game-schema';
import { getTraderAtLocation } from '../lib/traders';
import { BUILD_SHA } from '../lib/build-info';
import { Shield, Sword, MapPin, Coins, Scroll, ImageOff } from 'lucide-react';

function SidebarHeaderImage({
  primaryUrl,
  fallbackUrl,
  alt,
}: {
  primaryUrl: string;
  fallbackUrl: string;
  alt: string;
}) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'none'>(primaryUrl ? 'primary' : 'fallback');

  if (stage === 'none') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center opacity-50">
        <ImageOff className="text-slate-700 mb-6" size={48} />
      </div>
    );
  }

  const src = stage === 'primary' ? primaryUrl : fallbackUrl;

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover opacity-80 transition-opacity duration-700"
      key={`${stage}:${src}`}
      onError={() => setStage(prev => (prev === 'primary' ? 'fallback' : 'none'))}
    />
  );
}

export function LeftSidebar({ state }: { state: GameState }) {
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));
  const buildSha = process.env.NEXT_PUBLIC_GIT_SHA || BUILD_SHA;
  const trader = getTraderAtLocation(state.location);
  const [showBackpack, setShowBackpack] = useState(true);

  const imageUrl = state.currentImage || "";
  const locationTrail = state.locationHistory?.slice(-6) || [];

  const fallbackImageUrl =
    state.storyAct <= 0 ? '/prologue/gate.png' :
    state.storyAct === 1 ? '/prologue/ruins.png' :
    '/prologue/wanderer.png';

  return (
    <div className="h-full bg-slate-950 border-r border-slate-800 flex flex-col text-slate-200 overflow-hidden font-sans">
      {/* HEADER IMAGE */}
      <div className="relative w-full h-48 bg-slate-900 shrink-0 group overflow-hidden">
        <SidebarHeaderImage
          key={`${state.location}:${imageUrl}`}
          primaryUrl={imageUrl}
          fallbackUrl={fallbackImageUrl}
          alt={state.location}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        <div className="absolute bottom-4 left-4 right-4 z-10 space-y-2">
          <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2 drop-shadow-md">
            <MapPin size={20} />
            {state.location}
          </h2>
          {trader && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-900/70 border border-amber-700 px-3 py-1 text-[11px] uppercase tracking-widest text-amber-100">
              <Coins size={12} />
              Trader Nearby
            </div>
          )}
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

        {/* LOCATION TRAIL */}
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
          <button
            className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 hover:text-amber-400 transition-colors"
            onClick={() => setShowBackpack(!showBackpack)}
          >
            <span>Backpack</span>
            <span className="text-[10px] font-mono text-slate-400">{showBackpack ? 'Hide' : 'Show'}</span>
          </button>
          {showBackpack && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-3 text-[10px] uppercase tracking-widest text-slate-600">
        Build {buildSha}
      </div>
    </div>
  );
}
