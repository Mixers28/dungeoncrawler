'use client';

import { Eye, EyeOff } from 'lucide-react';

interface HeaderActions {
  viewMode: 'text' | 'visual';
  onToggleViewMode: () => void;
  onMainMenu: () => void;
  onRestart: () => void;
  isLoading: boolean;
}

interface MobileHeaderProps extends HeaderActions {
  onOpenStats: () => void;
  onOpenSpells: () => void;
}

/**
 * Narrow-viewport header. Rendered in both view modes so visual-mode players
 * keep access to the menu and the text-mode fallback; the Stats/Spells buttons
 * are text-mode surfaces and stay hidden in visual mode.
 */
export function MobileHeader({
  viewMode,
  onToggleViewMode,
  onMainMenu,
  onRestart,
  isLoading,
  onOpenStats,
  onOpenSpells,
}: MobileHeaderProps) {
  return (
    <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 px-4 z-10">
      <span className="font-bold text-amber-500 min-w-0 truncate">Dungeon Portal</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onMainMenu}
          disabled={isLoading}
          aria-label="Return to main menu"
          className="text-xs bg-slate-700 text-slate-200 font-bold px-3 py-1 rounded disabled:opacity-50"
        >
          Menu
        </button>
        <button
          onClick={onRestart}
          disabled={isLoading}
          aria-label="Start a new run"
          className="text-xs bg-amber-700 text-slate-900 font-bold px-3 py-1 rounded disabled:opacity-50"
        >
          New Run
        </button>
        {/* Icon-only: a text label here overflowed the 390px header and
            clipped the last button. */}
        <button
          onClick={onToggleViewMode}
          data-testid="toggle-view-mode-mobile"
          aria-label={`Switch to ${viewMode === 'text' ? 'visual' : 'text'} mode`}
          title={`Switch to ${viewMode === 'text' ? 'visual' : 'text'} mode`}
          className="bg-slate-800 text-slate-200 font-semibold p-2 rounded flex items-center"
        >
          {viewMode === 'visual' ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {viewMode === 'text' && (
          <>
            <button
              onClick={onOpenStats}
              aria-label="Open character stats sidebar"
              className="text-xs bg-slate-800 text-slate-200 font-semibold px-3 py-1 rounded"
            >
              Stats
            </button>
            <button
              onClick={onOpenSpells}
              aria-label="Open spells sidebar"
              className="text-xs bg-slate-800 text-slate-200 font-semibold px-3 py-1 rounded"
            >
              Spells
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Wide-viewport bar: view-mode toggle plus run-level actions. */
export function DesktopTopBar({
  viewMode,
  onToggleViewMode,
  onMainMenu,
  onRestart,
  isLoading,
}: HeaderActions) {
  return (
    <div className="hidden md:flex items-center justify-between mb-2 text-sm text-slate-400">
      <span className="font-semibold text-amber-500">Dungeon Portal</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleViewMode}
          data-testid="toggle-view-mode"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded flex items-center gap-2 transition-colors"
          title={`Switch to ${viewMode === 'text' ? 'visual' : 'text'} mode`}
        >
          {viewMode === 'visual' ? <EyeOff size={16} /> : <Eye size={16} />}
          <span className="hidden lg:inline">{viewMode === 'text' ? 'Visual' : 'Text'}</span>
        </button>
        <button
          onClick={onMainMenu}
          disabled={isLoading}
          aria-label="Return to main menu"
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Main Menu
        </button>
        <button
          onClick={onRestart}
          disabled={isLoading}
          aria-label="Start a new run"
          className="bg-amber-700 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Resetting...' : 'New Run'}
        </button>
      </div>
    </div>
  );
}
