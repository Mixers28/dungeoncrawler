'use client';

import type { FormEvent, ReactNode, RefObject } from 'react';
import { Skull } from 'lucide-react';

interface TurnInputAreaProps {
  isDead: boolean;
  deathCountdown: number | null;
  viewMode: 'text' | 'visual';
  /** Visual mode keeps the free-text field collapsed behind a toggle. */
  isAdvancedInputOpen: boolean;
  onToggleAdvanced: () => void;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement>;
  isLoading: boolean;
  canAct: boolean;
  /** Why the player cannot act; doubles as the text-mode placeholder. */
  actionDisabledReason: string | null;
  slotSummary?: string;
  /** Quick-insert command buttons, rendered above the text-mode form. */
  hints?: ReactNode;
}

export function TurnInputArea({
  isDead,
  deathCountdown,
  viewMode,
  isAdvancedInputOpen,
  onToggleAdvanced,
  input,
  onInputChange,
  onSubmit,
  onClear,
  inputRef,
  isLoading,
  canAct,
  actionDisabledReason,
  slotSummary,
  hints,
}: TurnInputAreaProps) {
  const inputDisabled = isLoading || !canAct;
  const submitDisabled = inputDisabled || !input.trim();

  if (isDead) {
    return (
      <div className="mt-4">
        <div className="bg-red-950/50 border border-red-900 p-6 rounded-lg flex flex-col items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3 text-red-500">
            <Skull size={32} />
            <h2 className="text-3xl font-black tracking-widest uppercase">You Died</h2>
            <Skull size={32} />
          </div>
          <p className="text-red-300/70 italic">
            Your journey ends here.{' '}
            {deathCountdown !== null && deathCountdown > 0 ? `Redirecting in: ${deathCountdown}` : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === 'visual') {
    return (
      <div className="mt-4">
        <div className="pt-2">
          <button
            type="button"
            onClick={onToggleAdvanced}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {isAdvancedInputOpen ? 'Hide advanced command input' : 'Advanced command input…'}
          </button>
          {isAdvancedInputOpen && (
            <form onSubmit={onSubmit} className="flex gap-2 mt-2">
              <input
                ref={inputRef}
                className="flex-1 bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                placeholder="What do you do?"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                disabled={inputDisabled}
              />
              <button
                type="submit"
                disabled={submitDisabled}
                className="bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                ACT
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {hints}
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 bg-slate-900 border border-slate-700 rounded p-4 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
          placeholder={actionDisabledReason || 'What do you do?'}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={inputDisabled}
          autoFocus
        />
        {slotSummary && <div className="hidden md:flex items-center text-xs text-slate-400 px-2">{slotSummary}</div>}
        <button
          type="submit"
          disabled={submitDisabled}
          className="bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold px-8 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ACT
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isLoading}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Clear input"
        >
          ✕
        </button>
      </form>
    </div>
  );
}
