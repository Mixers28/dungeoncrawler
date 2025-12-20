'use client';

import { useState } from 'react';
import { GameState } from '../lib/game-schema';
import { DiceTray } from './DiceTray';
import { Sword, Scroll, Skull, Heart } from 'lucide-react';

export function RightSidebar({ state, onInsertCommand }: { state: GameState; onInsertCommand?: (cmd: string) => void }) {
  const [showSpellbook, setShowSpellbook] = useState(true);

  const handleSpellClick = (name: string) => {
    const cmd = `cast ${name.toLowerCase()}`;
    if (onInsertCommand) {
      onInsertCommand(cmd);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cmd);
    }
  };

  return (
    <div className="h-full bg-slate-950 border-l border-slate-800 flex flex-col text-slate-200 overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <DiceTray state={state} />

        {/* SKILLS QUICK INSERT */}
        {state.skills && state.skills.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {state.skills.map((skill, idx) => (
                <button
                  key={`${skill}-${idx}`}
                  className="px-2 py-1 rounded border border-slate-800 bg-slate-900/60 text-xs text-slate-200 hover:border-amber-600 hover:text-amber-200 transition-colors"
                  onClick={() => onInsertCommand?.(`use ${skill.toLowerCase()}`)}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WEAPONS QUICK INSERT */}
        {state.inventory && state.inventory.some(i => i.type === 'weapon') && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Weapons
            </h3>
            <div className="flex flex-wrap gap-2">
              {state.inventory.filter(i => i.type === 'weapon').map((item, idx) => (
                <button
                  key={`${item.name}-${idx}`}
                  className="px-2 py-1 rounded border border-slate-800 bg-slate-900/60 text-xs text-slate-200 hover:border-amber-600 hover:text-amber-200 transition-colors"
                  onClick={() => onInsertCommand?.(`attack with ${item.name.toLowerCase()}`)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SPELLBOOK */}
        {state.knownSpells && state.knownSpells.length > 0 && (
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 hover:text-amber-400 transition-colors"
              onClick={() => setShowSpellbook(!showSpellbook)}
            >
              <span>Spellbook</span>
              <span className="text-[10px] font-mono text-slate-400">{showSpellbook ? 'Hide' : 'Show'}</span>
            </button>
            {showSpellbook && (
              <>
                <div className="space-y-2">
                  {state.knownSpells?.map((spell, i) => {
                    const prepared = state.preparedSpells?.some(s => s.toLowerCase() === spell.toLowerCase());
                    return (
                      <button
                        key={`${spell}-${i}`}
                        className="w-full flex items-center justify-between gap-2 p-2 bg-slate-900/50 rounded border border-transparent hover:border-amber-700 hover:bg-slate-800 text-left transition-colors"
                        onClick={() => handleSpellClick(spell)}
                        title="Click to copy a cast command"
                      >
                        <div className="flex items-center gap-2">
                          <Scroll size={16} className="text-amber-500" />
                          <span className="text-sm text-slate-200">{spell}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${prepared ? 'bg-amber-900/50 text-amber-200 border border-amber-700' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {prepared ? 'Prepared' : 'Known'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {state.spellSlots && Object.keys(state.spellSlots).length > 0 && (
                  <div className="text-[11px] text-slate-400">
                    <div className="uppercase tracking-widest text-slate-500 mb-1">Slots</div>
                    <div className="space-y-1">
                      {Object.entries(state.spellSlots).map(([lvl, data]) => (
                        <div key={lvl} className="flex items-center justify-between">
                          <span>{lvl.replace('_', ' ')}</span>
                          <span className="font-mono text-slate-200">{data.current}/{data.max}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* NEARBY ENTITIES */}
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
