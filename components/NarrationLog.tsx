'use client';

import { useEffect, useRef } from 'react';
import { type LogEntry, type NarrationMode } from '../lib/game-schema';
import { ScrollText, Sword, Search, Coins, Skull } from 'lucide-react';

interface NarrationLogProps {
  entries: LogEntry[];
  maxEntries?: number;
  showMode?: boolean;
  compact?: boolean;
}

/**
 * NarrationLog Component
 * 
 * Compact display of combat and exploration messages.
 * Features:
 * - Auto-scroll to latest message
 * - Mode-based icons for quick scanning
 * - Fade-out for older messages
 * - Compact mode for battlefield view
 */
export function NarrationLog({ 
  entries, 
  maxEntries = 10,
  showMode = false,
  compact = false,
}: NarrationLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new entries added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);
  
  // Show only recent entries
  const recentEntries = entries.slice(-maxEntries);
  
  const getModeIcon = (mode: NarrationMode) => {
    const iconClass = "flex-shrink-0";
    switch (mode) {
      case 'COMBAT_HIT':
        return <Sword size={14} className={`${iconClass} text-red-400`} />;
      case 'COMBAT_MISS':
        return <Sword size={14} className={`${iconClass} text-slate-500`} />;
      case 'COMBAT_KILL':
        return <Skull size={14} className={`${iconClass} text-red-500`} />;
      case 'SEARCH_FOUND':
        return <Search size={14} className={`${iconClass} text-green-400`} />;
      case 'SEARCH_EMPTY':
        return <Search size={14} className={`${iconClass} text-slate-500`} />;
      case 'LOOT_GAIN':
        return <Coins size={14} className={`${iconClass} text-yellow-400`} />;
      default:
        return <ScrollText size={14} className={`${iconClass} text-slate-400`} />;
    }
  };
  
  const getModeColor = (mode: NarrationMode) => {
    switch (mode) {
      case 'COMBAT_HIT':
      case 'COMBAT_KILL':
        return 'text-red-300';
      case 'COMBAT_MISS':
        return 'text-slate-500';
      case 'SEARCH_FOUND':
      case 'LOOT_GAIN':
        return 'text-green-300';
      case 'ROOM_INTRO':
        return 'text-amber-300';
      default:
        return 'text-slate-300';
    }
  };

  if (recentEntries.length === 0) {
    return (
      <div className={`bg-slate-900/50 rounded-lg border border-slate-800 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="text-center text-slate-600 text-sm">
          <ScrollText size={24} className="mx-auto mb-2 opacity-30" />
          <p>No messages yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-amber-900/30 shadow-lg ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
          <ScrollText size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-amber-100">Combat Log</h3>
          <span className="text-xs text-slate-500 ml-auto">
            {recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      )}
      
      {/* Messages */}
      <div 
        ref={scrollRef}
        className={`space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 ${
          compact ? 'max-h-40' : 'max-h-60'
        }`}
      >
        {recentEntries.map((entry, idx) => {
          const isOld = idx < recentEntries.length - 5;
          
          return (
            <div
              key={entry.id}
              className={`
                flex gap-2 text-sm transition-opacity duration-500
                ${isOld ? 'opacity-50' : 'opacity-100'}
                ${compact ? 'text-xs' : ''}
              `}
            >
              {showMode && (
                <div className="flex-shrink-0 mt-0.5">
                  {getModeIcon(entry.mode)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className={`${getModeColor(entry.mode)} leading-relaxed`}>
                  {entry.summary}
                </p>
                {entry.flavor && !compact && (
                  <p className="text-slate-500 text-xs mt-0.5 italic">
                    {entry.flavor}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Scroll Indicator */}
      {entries.length > maxEntries && (
        <div className="text-xs text-slate-600 text-center mt-2 pt-2 border-t border-slate-800">
          Showing last {maxEntries} of {entries.length} messages
        </div>
      )}
    </div>
  );
}
