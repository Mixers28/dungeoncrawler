'use client';

import { useState } from 'react';
import type { VisualSceneView, VisualThreatView } from '../../lib/visual/view-model';

interface DungeonViewportProps {
  scene: VisualSceneView;
  threats: VisualThreatView[];
  isCombatActive: boolean;
  lastActionKind?: 'melee' | 'spell';
  isBusy?: boolean;
  onCommand: (command: string) => void;
}

type FloatingNumber = { key: string; amount: number; kind: 'damage' | 'heal' };
type AttackFx = { key: string; kind: 'slash' | 'spell' };

export function DungeonViewport({ scene, threats, isCombatActive, lastActionKind = 'melee', isBusy = false, onCommand }: DungeonViewportProps) {
  const aliveThreats = threats.filter(threat => threat.isAlive);
  const defeatedThreats = threats.filter(threat => !threat.isAlive && threat.status === 'dead');

  const [prevHp, setPrevHp] = useState<Map<string, number>>(new Map());
  const [floatingByThreat, setFloatingByThreat] = useState<Map<string, FloatingNumber>>(new Map());
  const [fxByThreat, setFxByThreat] = useState<Map<string, AttackFx>>(new Map());

  // Adjust state during render (React-sanctioned pattern) instead of an effect:
  // detect HP changes against the last-seen snapshot and queue floating combat numbers.
  const hpChanged = threats.some(threat => prevHp.get(threat.id) !== threat.hp);
  if (hpChanged) {
    const nextPrevHp = new Map(prevHp);
    const updates = new Map<string, FloatingNumber>();
    const fxUpdates = new Map<string, AttackFx>();
    for (const threat of threats) {
      const prev = prevHp.get(threat.id);
      if (prev !== undefined && threat.hp !== prev) {
        updates.set(threat.id, {
          key: `${threat.id}:${threat.hp}`,
          amount: Math.abs(threat.hp - prev),
          kind: threat.hp < prev ? 'damage' : 'heal',
        });
        if (threat.hp < prev) {
          fxUpdates.set(threat.id, {
            key: `fx:${threat.id}:${threat.hp}`,
            kind: lastActionKind === 'spell' ? 'spell' : 'slash',
          });
        }
      }
      nextPrevHp.set(threat.id, threat.hp);
    }
    setPrevHp(nextPrevHp);
    if (updates.size > 0) {
      setFloatingByThreat(current => {
        const next = new Map(current);
        updates.forEach((value, id) => next.set(id, value));
        return next;
      });
    }
    if (fxUpdates.size > 0) {
      setFxByThreat(current => {
        const next = new Map(current);
        fxUpdates.forEach((value, id) => next.set(id, value));
        return next;
      });
    }
  }

  function clearFloating(threatId: string) {
    setFloatingByThreat(current => {
      if (!current.has(threatId)) return current;
      const next = new Map(current);
      next.delete(threatId);
      return next;
    });
  }

  function clearFx(threatId: string) {
    setFxByThreat(current => {
      if (!current.has(threatId)) return current;
      const next = new Map(current);
      next.delete(threatId);
      return next;
    });
  }

  function handleAttackClick(threat: VisualThreatView) {
    const command = threat.attackAction?.command;
    if (!command) return;
    onCommand(command);
  }

  return (
    <div className="relative flex-1 min-h-[240px] rounded-lg overflow-hidden border border-slate-800 bg-slate-900" data-testid="dungeon-viewport">
      <img
        src={scene.imagePath}
        alt={scene.location}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-amber-400 bg-black/50 px-2 py-1 rounded truncate">
          {scene.title || scene.location}
        </span>
        {isCombatActive && (
          <span className="text-xs font-bold text-red-400 bg-black/50 px-2 py-1 rounded uppercase tracking-wide flex-shrink-0">
            Combat
          </span>
        )}
      </div>

      {aliveThreats.length > 0 && (
        <div className={`absolute ${defeatedThreats.length > 0 ? 'bottom-28 md:bottom-32' : 'bottom-2'} left-2 right-2 flex flex-wrap gap-4 md:gap-6 justify-center items-end`}>
          {aliveThreats.map(threat => {
            const hpPct = Math.max(0, Math.min(100, (threat.hp / Math.max(1, threat.maxHp)) * 100));
            const attackAction = threat.attackAction;
            const floating = floatingByThreat.get(threat.id);
            const fx = fxByThreat.get(threat.id);
            return (
              <button
                key={threat.id}
                onClick={() => handleAttackClick(threat)}
                disabled={!attackAction?.enabled || isBusy}
                title={attackAction?.reason}
                data-testid="threat-standee"
                className="group flex flex-col items-center gap-1 bg-transparent transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="relative">
                  {floating && (
                    <span
                      key={floating.key}
                      onAnimationEnd={() => clearFloating(threat.id)}
                      className={`floating-combat-number absolute top-0 left-1/2 text-base md:text-lg font-extrabold drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${floating.kind === 'damage' ? 'text-red-400' : 'text-green-400'}`}
                    >
                      {floating.kind === 'damage' ? '-' : '+'}{floating.amount}
                    </span>
                  )}
                  {threat.imagePath && (
                    <img
                      src={threat.imagePath}
                      alt=""
                      className={`w-28 h-28 md:w-40 md:h-40 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.85)] group-hover:drop-shadow-[0_8px_16px_rgba(220,38,38,0.55)] transition-[filter] ${
                        floating?.kind === 'damage' ? 'animate-hit-flash animate-shake-frame' : floating?.kind === 'heal' ? 'animate-heal-flash' : ''
                      }`}
                    />
                  )}
                  {fx && (
                    <span
                      key={fx.key}
                      onAnimationEnd={() => clearFx(threat.id)}
                      className={fx.kind === 'spell' ? 'fx-spell-burst' : 'fx-slash'}
                      data-testid={`attack-fx-${fx.kind}`}
                    />
                  )}
                </div>
                <span className="text-xs md:text-sm font-semibold text-slate-100 max-w-[130px] md:max-w-[160px] truncate bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {threat.name}
                </span>
                <div className="w-20 md:w-28 h-1.5 rounded-full bg-black/50 overflow-hidden">
                  <div className="h-full bg-red-500 transition-[width] duration-300" style={{ width: `${hpPct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {defeatedThreats.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-4 justify-center items-end">
          {defeatedThreats.map(threat => {
            const lootAction = threat.lootAction;
            const cleanName = threat.name.replace(/\s*\(looted\)\s*$/i, '');
            const isLooted = threat.name.toLowerCase().includes('looted');
            return (
              <button
                key={threat.id}
                onClick={() => lootAction?.command && onCommand(lootAction.command)}
                disabled={!lootAction?.enabled || isBusy}
                title={lootAction?.reason}
                data-testid="corpse-standee"
                className="group flex flex-col items-center gap-1 bg-transparent transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {threat.imagePath && (
                  <img
                    src={threat.imagePath}
                    alt=""
                    className="w-20 h-20 md:w-24 md:h-24 object-contain grayscale opacity-60 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] group-hover:opacity-80 transition-opacity"
                  />
                )}
                <span className="flex items-center gap-1.5 text-[11px] bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  <span className="font-semibold text-slate-300 line-through truncate max-w-24">{cleanName}</span>
                  <span className="font-bold uppercase tracking-wide text-amber-300">
                    {isLooted ? 'Looted' : 'Loot'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
