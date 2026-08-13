'use client';

import { BookOpen, Users } from 'lucide-react';
import { ARCHETYPES, type ArchetypeKey } from '../app/characters';
import type { SavedGameSummary } from '../app/actions';

interface CharacterSelectScreenProps {
  selectedClass: ArchetypeKey | null;
  onSelectClass: (key: ArchetypeKey) => void;
  isLoading: boolean;
  error: string | null;
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoin: () => void;
  canJoin: boolean;
  /** `undefined` while the save is still loading, `null` when there is none. */
  saveSummary: SavedGameSummary | null | undefined;
  isNewRun: boolean;
  onStart: (mode: 'continue' | 'new') => void;
}

export function CharacterSelectScreen({
  selectedClass,
  onSelectClass,
  isLoading,
  error,
  joinCode,
  onJoinCodeChange,
  onJoin,
  canJoin,
  saveSummary,
  isNewRun,
  onStart,
}: CharacterSelectScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="w-full max-w-4xl space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h1 className="text-3xl font-black text-amber-500 flex items-center gap-3 mb-4">
            <BookOpen size={28} />
            Choose Your Path
          </h1>
          <p className="text-slate-400 mb-4">Pick a quick-start archetype to begin.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(ARCHETYPES).map(([key, data]) => (
              <button
                key={key}
                onClick={() => onSelectClass(key as ArchetypeKey)}
                className={`text-left p-4 rounded border transition-all ${selectedClass === key ? 'border-amber-500 bg-amber-900/20' : 'border-slate-800 bg-slate-900 hover:border-amber-700'}`}
                disabled={isLoading}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-amber-400">{data.label}</h2>
                  <span className="text-xs text-slate-500">{data.background}</span>
                </div>
                <p className="text-sm text-slate-300 mt-2">HP +{data.hpBonus}, AC +{data.acBonus}</p>
                <p className="text-xs text-slate-400 mt-1">Starts with {data.startingWeapon}{data.startingArmor ? ` and ${data.startingArmor}` : ''}</p>
              </button>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <div className="mt-6 border-t border-slate-800 pt-4 flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Users size={16} />
                Join Party
              </div>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => onJoinCodeChange(e.target.value)}
                  placeholder="CODE"
                  maxLength={6}
                  className="w-32 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:border-amber-500"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={onJoin}
                  disabled={isLoading || !canJoin}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join
                </button>
              </div>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2">
              {saveSummary && (
                <button
                  onClick={() => onStart('continue')}
                  disabled={isLoading}
                  data-testid="continue-run"
                  className="bg-amber-600 hover:bg-amber-700 text-slate-900 text-lg font-bold py-3 px-6 rounded transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20"
                >
                  {isLoading ? 'Loading...' : `Continue as ${saveSummary.name} the ${saveSummary.className} (Lv ${saveSummary.level})`}
                </button>
              )}
              <button
                onClick={() => onStart('new')}
                disabled={isLoading || (saveSummary === undefined && !isNewRun)}
                data-testid="start-new-run"
                className={`${saveSummary
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-bold py-2 px-6'
                  : 'bg-amber-600 hover:bg-amber-700 text-slate-900 text-lg font-bold py-3 px-6 shadow-lg shadow-amber-900/20'
                } rounded transition-all disabled:opacity-50`}
              >
                {isLoading
                  ? 'Loading...'
                  : saveSummary
                    ? `Start New Run as ${selectedClass ? ARCHETYPES[selectedClass].label : '…'}`
                    : 'Enter the Realm'}
              </button>
              {saveSummary && (
                <p className="text-xs text-slate-500">Starting a new run abandons your current save.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
