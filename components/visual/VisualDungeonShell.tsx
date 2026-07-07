'use client';

import { useState } from 'react';
import type { GameState } from '../../lib/game-schema';
import type { VisualGameViewModel } from '../../lib/visual/view-model';
import { NarrationLog } from '../NarrationLog';
import { PartyRail } from './PartyRail';
import { DungeonViewport } from './DungeonViewport';
import { MovementCluster } from './MovementCluster';
import { ActionTray } from './ActionTray';
import { VisualDrawer } from './VisualDrawer';
import { InventoryDrawerContent } from './InventoryDrawerContent';
import { SpellbookDrawerContent } from './SpellbookDrawerContent';

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

  const dispatchFromDrawer = (command: string, closeDrawer: () => void) => {
    onCommand(command);
    closeDrawer();
  };

  return (
    <div className="flex flex-col h-full gap-2 md:gap-3">
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 flex-1 min-h-0">
        {/* Party rail: horizontal strip on mobile, vertical column on desktop */}
        <div className="order-2 md:order-1 md:w-48 flex-shrink-0">
          <PartyRail slots={viewModel.partySlots} />
        </div>

        {/* Dungeon viewport dominates the screen */}
        <div className="order-1 md:order-2 flex-1 flex flex-col min-h-0">
          <DungeonViewport
            scene={viewModel.scene}
            threats={viewModel.threats}
            isCombatActive={viewModel.turnState.mode === 'combat'}
            onCommand={onCommand}
          />
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

      {/* Movement cluster, action tray, and compact log strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        <MovementCluster actions={viewModel.movementActions} onCommand={onCommand} />
        <ActionTray
          actions={actionButtons}
          onCommand={onCommand}
          onInventoryOpen={() => setIsInventoryDrawerOpen(true)}
          onSpellbookOpen={() => setIsSpellbookDrawerOpen(true)}
          disabled={!canAct}
        />
        <div className="max-h-32 md:max-h-none overflow-y-auto" data-testid="log-strip">
          <NarrationLog entries={viewModel.logEntries} maxEntries={5} compact />
        </div>
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
    </div>
  );
}
