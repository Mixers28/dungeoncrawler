'use client';

import { useEffect, useState } from 'react';
import { Coins, X } from 'lucide-react';
import type { VisualTurnEventItem } from '../../lib/visual/view-model';

export type LootReveal = {
  id: string;
  sourceName?: string;
  coins: number;
  items: VisualTurnEventItem[];
};

interface LootRevealOverlayProps {
  loot: LootReveal;
  onDismiss: () => void;
}

const DISMISS_AFTER_COLLECT_MS = 550;

export function LootRevealOverlay({ loot, onDismiss }: LootRevealOverlayProps) {
  const [collected, setCollected] = useState<Set<string>>(new Set());

  const tileKeys = loot.items.map((item, idx) => `item-${idx}-${item.name}`);
  if (loot.coins > 0) tileKeys.push('coins');
  const allCollected = tileKeys.length > 0 && tileKeys.every(key => collected.has(key));

  useEffect(() => {
    if (!allCollected) return;
    const timer = setTimeout(onDismiss, DISMISS_AFTER_COLLECT_MS);
    return () => clearTimeout(timer);
  }, [allCollected, onDismiss]);

  const collect = (key: string) => {
    setCollected(current => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg"
      data-testid="loot-reveal-overlay"
      onClick={onDismiss}
    >
      <div
        className="animate-slide-up w-full max-w-sm mx-4 rounded-lg border border-amber-700/60 bg-slate-900/95 p-4 shadow-[0_0_30px_rgba(217,119,6,0.25)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-400">
            {loot.sourceName ? `Loot — ${loot.sourceName}` : 'Loot'}
          </h2>
          <button
            onClick={onDismiss}
            aria-label="Close loot"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {loot.items.map((item, idx) => {
            const key = `item-${idx}-${item.name}`;
            const isCollected = collected.has(key);
            return (
              <button
                key={key}
                onClick={() => collect(key)}
                disabled={isCollected}
                data-testid="loot-reveal-item"
                className={`flex flex-col items-center gap-1 rounded border border-slate-700 bg-slate-800/80 p-2 transition-colors hover:border-amber-600 disabled:cursor-default ${
                  isCollected ? 'animate-loot-collect' : ''
                }`}
              >
                <span className="relative">
                  {item.imagePath ? (
                    <img src={item.imagePath} alt="" className="w-12 h-12 object-contain" />
                  ) : (
                    <span className="block w-12 h-12 rounded bg-slate-700" />
                  )}
                  {item.quantity > 1 && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
                      x{item.quantity}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-tight text-center text-slate-200 capitalize">
                  {item.name}
                </span>
              </button>
            );
          })}

          {loot.coins > 0 && (
            <button
              onClick={() => collect('coins')}
              disabled={collected.has('coins')}
              data-testid="loot-reveal-coins"
              className={`flex flex-col items-center justify-center gap-1 rounded border border-slate-700 bg-slate-800/80 p-2 transition-colors hover:border-amber-600 disabled:cursor-default ${
                collected.has('coins') ? 'animate-loot-collect' : ''
              }`}
            >
              <Coins size={40} className="text-yellow-400" />
              <span className="text-[11px] font-semibold text-yellow-300">{loot.coins} gold</span>
            </button>
          )}
        </div>

        <button
          onClick={() => tileKeys.forEach(collect)}
          className="mt-3 w-full rounded bg-amber-600 hover:bg-amber-700 py-1.5 text-sm font-bold text-white transition-colors"
        >
          Take All
        </button>
      </div>
    </div>
  );
}
