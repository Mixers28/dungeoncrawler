'use client';

import { Check, Copy, Users } from 'lucide-react';

interface PartyBarProps {
  /** null while running solo. */
  session: { code: string; playerCount: number } | null;
  /** Why the player cannot act right now; null when they can. */
  actionDisabledReason: string | null;
  copiedPartyCode: boolean;
  onCopyPartyCode: () => void;
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  canJoin: boolean;
  isLoading: boolean;
}

export function PartyBar({
  session,
  actionDisabledReason,
  copiedPartyCode,
  onCopyPartyCode,
  joinCode,
  onJoinCodeChange,
  onCreate,
  onJoin,
  canJoin,
  isLoading,
}: PartyBarProps) {
  return (
    <div className="mb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-slate-800 bg-slate-900/70 rounded px-3 py-2 text-xs text-slate-300">
      <div className="flex items-center gap-2 min-w-0">
        <Users size={14} className="text-amber-500 flex-shrink-0" />
        {session ? (
          <>
            <span className="font-semibold text-amber-400">Party {session.code}</span>
            <button
              type="button"
              onClick={onCopyPartyCode}
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-300"
              aria-label="Copy party code"
              title="Copy party code"
            >
              {copiedPartyCode ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <span className="text-slate-500 truncate">
              {session.playerCount} player{session.playerCount === 1 ? '' : 's'}
              {actionDisabledReason ? ` · ${actionDisabledReason}` : ' · You can act'}
            </span>
          </>
        ) : (
          <span className="text-slate-400">Solo run</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!session && (
          <button
            type="button"
            onClick={onCreate}
            disabled={isLoading}
            className="bg-amber-700 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Party
          </button>
        )}
        <input
          value={joinCode}
          onChange={(e) => onJoinCodeChange(e.target.value)}
          placeholder="CODE"
          maxLength={6}
          disabled={isLoading}
          className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 uppercase tracking-widest focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={onJoin}
          disabled={isLoading || !canJoin}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join
        </button>
      </div>
    </div>
  );
}
