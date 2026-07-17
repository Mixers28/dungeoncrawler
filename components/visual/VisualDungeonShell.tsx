'use client';

import { useState } from 'react';
import type { GameState } from '../../lib/game-schema';
import type { VisualGameViewModel, VisualTurnEventItem } from '../../lib/visual/view-model';
import { NarrationLog } from '../NarrationLog';
import { PartyRail } from './PartyRail';
import { DungeonViewport } from './DungeonViewport';
import { MovementCluster } from './MovementCluster';
import { ActionTray } from './ActionTray';
import { VisualDrawer } from './VisualDrawer';
import { InventoryDrawerContent } from './InventoryDrawerContent';
import { SpellbookDrawerContent } from './SpellbookDrawerContent';
import { LootRevealOverlay, type LootReveal } from './LootRevealOverlay';

interface VisualDungeonShellProps {
  gameState: GameState;
  viewModel: VisualGameViewModel | null;
  isLoading: boolean;
  onCommand: (command: string) => void;
  onOpenFullInventory: () => void;
}

export function VisualDungeonShell({ gameState, viewModel, isLoading, onCommand, onOpenFullInventory }: VisualDungeonShellProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isInventoryDrawerOpen, setIsInventoryDrawerOpen] = useState(false);
  const [isSpellbookDrawerOpen, setIsSpellbookDrawerOpen] = useState(false);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [lastActionKind, setLastActionKind] = useState<'melee' | 'spell'>('melee');
  const [seenLootLogId, setSeenLootLogId] = useState<string | null>(null);
  const [activeLoot, setActiveLoot] = useState<LootReveal | null>(null);

  // Track what kind of action produced the next damage tick so the viewport
  // can pick the matching hit effect (weapon slash vs spell burst).
  const dispatchCommand = (command: string) => {
    setLastActionKind(command.trim().toLowerCase().startsWith('cast ') ? 'spell' : 'melee');
    onCommand(command);
  };

  if (!viewModel) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading visual view…
      </div>
    );
  }

  const activeQuests = gameState.quests.filter(quest => quest.status === 'active');
  const canAct = viewModel.turnState.canAct && !isLoading;
  const actionButtons = viewModel.turnState.mode === 'combat' ? viewModel.combatActions : viewModel.explorationActions;

  // Adjust state during render (React-sanctioned pattern): baseline the newest
  // log id on first render so a restored save doesn't pop a stale loot reveal,
  // then open the overlay whenever fresh entries carry loot/coins events.
  const logEntries = viewModel.logEntries;
  const latestLogId = logEntries.length > 0 ? logEntries[logEntries.length - 1].id : 'empty';
  if (seenLootLogId === null) {
    setSeenLootLogId(latestLogId);
  } else if (seenLootLogId !== latestLogId) {
    const seenIdx = logEntries.findIndex(entry => entry.id === seenLootLogId);
    const freshEntries = logEntries.slice(seenIdx + 1);
    const items: VisualTurnEventItem[] = [];
    let coins = 0;
    let sourceName: string | undefined;
    for (const entry of freshEntries) {
      for (const event of entry.events || []) {
        if (event.type === 'loot') {
          items.push(...(event.items || []));
          sourceName = sourceName || event.targetName;
        } else if (event.type === 'coins') {
          coins += event.amount || 0;
          sourceName = sourceName || event.targetName;
        }
      }
    }
    if (items.length > 0 || coins > 0) {
      setActiveLoot({ id: latestLogId, sourceName, coins, items });
    }
    setSeenLootLogId(latestLogId);
  }

  const dispatchFromDrawer = (command: string, closeDrawer: () => void) => {
    dispatchCommand(command);
    closeDrawer();
  };

  // Visual mode shows loot in the reveal overlay and damage as standee FX, so
  // keep the message strip to story/flavor text instead of mechanical lines.
  const visibleLogEntries = logEntries
    .filter(entry => {
      const hasLootEvents = entry.events?.some(event => event.type === 'loot' || event.type === 'coins');
      return !(entry.mode === 'LOOT_GAIN' && hasLootEvents);
    })
    .map(entry => {
      if ((entry.mode === 'COMBAT_HIT' || entry.mode === 'COMBAT_KILL') && entry.flavor) {
        return { ...entry, summary: entry.flavor, flavor: undefined };
      }
      return entry;
    });

  return (
    <div className="flex flex-col h-full gap-2 md:gap-3">
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 flex-1 min-h-0">
        {/* Party rail: horizontal strip on mobile, vertical column on desktop */}
        <div className="order-2 md:order-1 md:w-48 flex-shrink-0">
          <PartyRail slots={viewModel.partySlots} />
        </div>

        {/* Dungeon viewport dominates the screen */}
        <div className="order-1 md:order-2 flex-1 flex flex-col min-h-0 relative">
          <DungeonViewport
            scene={viewModel.scene}
            threats={viewModel.threats}
            isCombatActive={viewModel.turnState.mode === 'combat'}
            lastActionKind={lastActionKind}
            isBusy={isLoading}
            onCommand={dispatchCommand}
          />
          {activeLoot && (
            <LootRevealOverlay loot={activeLoot} onDismiss={() => setActiveLoot(null)} />
          )}
        </div>

        {/* Context drawer: optional details, desktop only for Phase 0 */}
        <div className="order-3 hidden md:block md:w-56 flex-shrink-0">
          <button
            onClick={() => setIsDetailsOpen(prev => !prev)}
            className="w-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-2 rounded mb-2 transition-colors"
          >
            {isDetailsOpen ? 'Hide Details' : 'Show Details'}
          </button>
          {isDetailsOpen && (
            <div className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded p-2 space-y-2 max-h-60 overflow-y-auto">
              <div className="font-semibold text-amber-400">Active Quests</div>
              {activeQuests.length === 0 && <div className="text-slate-500">None</div>}
              {activeQuests.map(quest => (
                <div key={quest.id}>
                  <div className="font-medium">{quest.title}</div>
                  <div className="text-slate-500">{quest.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!canAct && viewModel.turnState.reason && (
        <div className="text-xs text-center text-amber-500">{viewModel.turnState.reason}</div>
      )}

      {/* Movement cluster and action tray; the narration log lives in a drawer
          because FX, damage numbers, and loot reveals already show the outcome. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
        <MovementCluster actions={viewModel.movementActions} onCommand={dispatchCommand} />
        <ActionTray
          actions={actionButtons}
          onCommand={dispatchCommand}
          onInventoryOpen={() => setIsInventoryDrawerOpen(true)}
          onSpellbookOpen={() => setIsSpellbookDrawerOpen(true)}
          onLogOpen={() => setIsLogDrawerOpen(true)}
          disabled={!canAct}
        />
      </div>

      <VisualDrawer title="Inventory" isOpen={isInventoryDrawerOpen} onClose={() => setIsInventoryDrawerOpen(false)}>
        <InventoryDrawerContent
          actions={viewModel.inventoryActions}
          onCommand={(command) => dispatchFromDrawer(command, () => setIsInventoryDrawerOpen(false))}
          onOpenFullInventory={() => {
            setIsInventoryDrawerOpen(false);
            onOpenFullInventory();
          }}
        />
      </VisualDrawer>

      <VisualDrawer title="Spellbook" isOpen={isSpellbookDrawerOpen} onClose={() => setIsSpellbookDrawerOpen(false)}>
        <SpellbookDrawerContent
          actions={viewModel.spellActions}
          onCommand={(command) => dispatchFromDrawer(command, () => setIsSpellbookDrawerOpen(false))}
        />
      </VisualDrawer>

      <VisualDrawer title="Adventure Log" isOpen={isLogDrawerOpen} onClose={() => setIsLogDrawerOpen(false)}>
        <div data-testid="log-strip">
          <NarrationLog entries={visibleLogEntries} maxEntries={12} />
        </div>
      </VisualDrawer>
    </div>
  );
}
