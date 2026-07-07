'use client';

import type { VisualSceneView, VisualThreatView } from '../../lib/visual/view-model';

interface DungeonViewportProps {
  scene: VisualSceneView;
  threats: VisualThreatView[];
  isCombatActive: boolean;
  onCommand: (command: string) => void;
}

export function DungeonViewport({ scene, threats, isCombatActive, onCommand }: DungeonViewportProps) {
  const aliveThreats = threats.filter(threat => threat.isAlive);

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
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-2 justify-center">
          {aliveThreats.map(threat => {
            const hpPct = Math.max(0, Math.min(100, (threat.hp / Math.max(1, threat.maxHp)) * 100));
            const attackAction = threat.attackAction;
            return (
              <button
                key={threat.id}
                onClick={() => attackAction?.command && onCommand(attackAction.command)}
                disabled={!attackAction?.enabled}
                title={attackAction?.reason}
                data-testid="threat-standee"
                className="flex flex-col items-center gap-1 bg-black/60 hover:bg-black/80 border border-red-800 rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xs font-semibold text-red-300">{threat.name}</span>
                <div className="w-16 h-1 rounded bg-slate-800 overflow-hidden">
                  <div className="h-full bg-red-600" style={{ width: `${hpPct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
