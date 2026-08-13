'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GameState, LogEntry, NarrationMode, RollEvent } from '../lib/game-schema';
import type { MultiplayerSessionSnapshot } from '../lib/game/session-service';
import { isValidSessionCode, normalizeSessionCodeInput } from '../lib/game/session-code';
import { composeGameStateForSolo } from '../lib/game/state-split';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { InventoryModal } from '../components/InventoryModal';
import { CharacterSelectScreen } from '../components/CharacterSelectScreen';
import { PrologueOverlay } from '../components/PrologueOverlay';
import { PartyBar } from '../components/PartyBar';
import { TurnInputArea } from '../components/TurnInputArea';
import { DesktopTopBar, MobileHeader } from '../components/GameHeader';
import { MobileSidebarDrawer } from '../components/MobileSidebarDrawer';
import { VisualDungeonShell } from '../components/visual/VisualDungeonShell';
import type { VisualGameViewModel } from '../lib/visual/view-model';
// Leaf import on purpose: importing a value from view-model would pull the
// story loader's `fs` dependency into this client bundle.
import { resolveTurnHolderName } from '../lib/visual/turn-holder';
import { getMultiplayerVisualViewModel, getVisualViewModel } from './visual-actions';
import {
  createMultiplayerFromCurrentGame,
  createNewGame,
  getSavedGameSummary,
  joinMultiplayerByCode,
  loadCurrentMultiplayerSession,
  processMultiplayerTurn,
  processTurn,
  resetGame,
  type SavedGameSummary,
} from './actions';
import { type ArchetypeKey } from './characters';
import { saveScore } from '../lib/leaderboard';
import { CommandHints } from '../components/CommandHints';
import { DiceRollRow } from '../components/DiceRollBadge';

type UserMessage = { role: 'user'; content: string };
type AssistantMessage = { role: 'assistant'; summary: string; flavor?: string; mode?: NarrationMode; createdAt?: string; rolls?: RollEvent[] };
type Message = UserMessage | AssistantMessage;

const VALID_QUICK_ACTIONS = ['attack', 'cast', 'item', 'run'] as const;
type QuickAction = typeof VALID_QUICK_ACTIONS[number];
const isQuickAction = (value: string): value is QuickAction =>
  (VALID_QUICK_ACTIONS as readonly string[]).includes(value);

const DEATH_REDIRECT_DELAY_MS = 3000;

const PROLOGUE_STEPS = [
  {
    text: "The Kingdom of Aethelgard has fallen. The Iron King, mad with grief, locked himself in the Sunken Citadel, taking the Crown of Light with him.",
    image: "/prologue/ruins.png"
  },
  {
    text: "For fifty years, the land has rotted. Crops fail, the dead walk, and the sun rarely breaks the grey clouds. You are a Gravewalker, hired by the desperate few who remain.",
    image: "/prologue/wanderer.png"
  },
  {
    text: "Your contract is simple: Breach the Citadel. Find the King. End the Curse. You stand now before the Iron Gate. There is no turning back.",
    image: "/prologue/gate.png"
  }
];

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [input, setInput] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [multiplayerSession, setMultiplayerSession] = useState<MultiplayerSessionSnapshot | null>(null);
  const [visualViewModel, setVisualViewModel] = useState<VisualGameViewModel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copiedPartyCode, setCopiedPartyCode] = useState(false);
  const [isDying, setIsDying] = useState(false);
  const [deathCountdown, setDeathCountdown] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<ArchetypeKey | null>('fighter');
  const [error, setError] = useState<string | null>(null);
  // undefined = still checking; null = no save; object = resumable run.
  const [saveSummary, setSaveSummary] = useState<SavedGameSummary | null | undefined>(undefined);

  // UI states
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'visual'>('text');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isAdvancedInputOpen, setIsAdvancedInputOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  // Synchronous in-flight guard: isLoading state does not update until after
  // the current tick, so two clicks in one tick would both dispatch a turn.
  const turnInFlightRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewRun = searchParams.has('newRun');
  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  const lastSlots = gameState?.spellSlots
    ? Object.entries(gameState.spellSlots)
      .map(([lvl, data]) => `${lvl.replace('_', ' ')} ${data.current}/${data.max}`)
      .join(' · ')
    : '';
  const multiplayerCanAct = !multiplayerSession
    || (
      multiplayerSession.you.hp > 0
      && (
        !multiplayerSession.session.isCombatActive
        || !multiplayerSession.session.currentTurnPlayerId
        || multiplayerSession.session.currentTurnPlayerId === multiplayerSession.you.playerId
      )
    );
  const actionDisabledReason = multiplayerSession && !multiplayerCanAct
    ? multiplayerSession.you.hp <= 0
      ? 'You are down.'
      : `Waiting for ${resolveTurnHolderName(multiplayerSession.players, multiplayerSession.session.currentTurnPlayerId)}.`
    : null;
  const normalizedJoinCode = normalizeSessionCodeInput(joinCode);
  const canJoinParty = isValidSessionCode(normalizedJoinCode);

  const messagesFromLog = useCallback((log: LogEntry[]): Message[] =>
    (log || []).map((entry) => ({
      role: 'assistant',
      summary: entry.actorName ? `${entry.actorName}: ${entry.summary}` : entry.summary,
      flavor: entry.flavor,
      mode: entry.mode,
      createdAt: entry.createdAt,
      rolls: entry.rolls,
    })), []);

  const applyMultiplayerSnapshot = useCallback((snapshot: MultiplayerSessionSnapshot) => {
    setMultiplayerSession(snapshot);
    setJoinCode(snapshot.code);
    setGameState(composeGameStateForSolo(snapshot.session, snapshot.you));
    setMessages(messagesFromLog(snapshot.session.log || []));
  }, [messagesFromLog]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Visual mode consumes Codex's buildVisualGameViewModel instead of duplicating
  // story exit/combat-availability rules on the frontend.
  useEffect(() => {
    if (viewMode !== 'visual' || !gameState) return;
    let cancelled = false;
    const loadViewModel = multiplayerSession
      ? getMultiplayerVisualViewModel({
          session: multiplayerSession.session,
          you: multiplayerSession.you,
          players: multiplayerSession.players.map(player => ({ userId: player.userId, character: player.character })),
        })
      : getVisualViewModel(gameState);
    loadViewModel.then(vm => {
      if (!cancelled) setVisualViewModel(vm);
    });
    return () => {
      cancelled = true;
    };
  }, [viewMode, gameState, multiplayerSession]);

  useEffect(() => {
    if (!multiplayerSession?.code) return;
    let cancelled = false;
    const poll = async () => {
      if (isLoading) return;
      try {
        const fresh = await loadCurrentMultiplayerSession(multiplayerSession.code);
        if (!cancelled && fresh && fresh.version !== multiplayerSession.version) {
          applyMultiplayerSnapshot(fresh);
        }
      } catch (err) {
        console.error('Session poll failed', err);
      }
    };
    const interval = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyMultiplayerSnapshot, isLoading, multiplayerSession?.code, multiplayerSession?.version]);

  const handleDeath = useCallback((state: GameState) => {
    if (isDying) return;
    setIsDying(true);
    setDeathCountdown(3);
    saveScore(state, 'loss');

    countdownIntervalRef.current = setInterval(() => {
      setDeathCountdown(prev => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);

    setTimeout(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      router.push('/splash');
    }, DEATH_REDIRECT_DELAY_MS);
  }, [isDying, router]);

  const executeTurn = useCallback(async (command: string, currentGameState: GameState) => {
    if (turnInFlightRef.current) return;
    if (multiplayerSession && !multiplayerCanAct) {
      if (actionDisabledReason) setError(actionDisabledReason);
      return;
    }
    turnInFlightRef.current = true;
    setInput('');
    focusInput();
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: command }]);

    try {
      if (multiplayerSession) {
        const result = await processMultiplayerTurn(multiplayerSession.code, command);
        if (!result.accepted) {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              summary: result.logEntry.summary,
              flavor: result.logEntry.flavor,
              mode: result.logEntry.mode,
              createdAt: result.logEntry.createdAt,
              rolls: result.logEntry.rolls,
            },
          ]);
          return;
        }
        const fresh = await loadCurrentMultiplayerSession(multiplayerSession.code);
        if (fresh) {
          applyMultiplayerSnapshot(fresh);
          const freshState = composeGameStateForSolo(fresh.session, fresh.you);
          if (freshState.hp <= 0 && currentGameState.hp > 0) {
            setTimeout(() => handleDeath(freshState), 500);
          }
        }
        return;
      }

      const { newState, logEntry } = await processTurn(command);
      setGameState(newState);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          summary: logEntry.summary,
          flavor: logEntry.flavor,
          mode: logEntry.mode,
          createdAt: logEntry.createdAt,
          rolls: logEntry.rolls,
        }
      ]);

      if (newState.hp <= 0 && currentGameState.hp > 0) {
        setTimeout(() => handleDeath(newState), 500);
        return;
      }

    } catch (err) {
      console.error("Turn Error:", err);
      setError("Failed to process turn. Please try again.");
    } finally {
      turnInFlightRef.current = false;
      setIsLoading(false);
      focusInput();
    }
  }, [actionDisabledReason, applyMultiplayerSnapshot, focusInput, handleDeath, multiplayerCanAct, multiplayerSession]);

  const handleQuickAction = useCallback((action: string) => {
    if (isLoading || !gameState || isDying || !multiplayerCanAct) return;
    if (!isQuickAction(action)) return;

    const commandMap: Record<QuickAction, string> = {
      attack: 'attack',
      cast: 'cast',
      item: 'use potion',
      run: 'run away',
    };

    const command = commandMap[action];
    if (command) executeTurn(command, gameState);
  }, [isLoading, gameState, isDying, multiplayerCanAct, executeTurn]);

  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'text' ? 'visual' : 'text';
    setViewMode(newMode);
    localStorage.setItem('dungeon_portal_view_mode', newMode);
  }, [viewMode]);

  const handleItemUse = useCallback((item: string) => {
    if (gameState && multiplayerCanAct) executeTurn(`use ${item}`, gameState);
  }, [gameState, multiplayerCanAct, executeTurn]);

  // Load view mode preference on mount
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedViewMode = localStorage.getItem('dungeon_portal_view_mode');
      if (savedViewMode === 'visual' || savedViewMode === 'text') {
        setViewMode(savedViewMode);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Keyboard shortcuts for combat actions
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      const currentState = gameStateRef.current;
      if (!currentState?.isCombatActive) return;
      if (isLoading || isDying) return;

      const key = e.key.toLowerCase();
      if (key === 'a') handleQuickAction('attack');
      else if (key === 'c') handleQuickAction('cast');
      else if (key === 'i') handleQuickAction('item');
      else if (key === 'r') handleQuickAction('run');
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLoading, isDying, handleQuickAction]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) focusInput();
  }, [isLoading, messages.length, focusInput]);

  // Check for a resumable save so the select screen can offer Continue vs New Run.
  useEffect(() => {
    if (gameState || isNewRun) return;
    let cancelled = false;
    getSavedGameSummary()
      .then(summary => { if (!cancelled) setSaveSummary(summary); })
      .catch(() => { if (!cancelled) setSaveSummary(null); });
    return () => {
      cancelled = true;
    };
  }, [gameState, isNewRun]);

  async function handleStart(mode: 'continue' | 'new') {
    setIsLoading(true);
    try {
      if (mode === 'new' && !selectedClass) {
        setError("Select a class to begin.");
        setIsLoading(false);
        return;
      }

      // 'continue' resumes the saved run as-is; 'new' honours the picked class
      // and overwrites any existing save (the user chose this explicitly).
      const initialState = mode === 'continue'
        ? await createNewGame({})
        : await createNewGame({ archetypeKey: selectedClass!, forceNew: true });
      setMultiplayerSession(null);
      setGameState(initialState);

      const restoredLog: Message[] = (initialState.log || []).map((entry: LogEntry) => ({
        role: 'assistant',
        summary: entry.summary,
        flavor: entry.flavor,
        mode: entry.mode,
        createdAt: entry.createdAt,
        rolls: entry.rolls,
      }));

      if (restoredLog.length > 0) {
        setMessages(restoredLog);
      } else if (initialState.narrativeHistory && initialState.narrativeHistory.length > 0) {
        const restoredHistory: Message[] = initialState.narrativeHistory.map(entry => ({
          role: 'assistant',
          summary: entry
        }));
        setMessages(restoredHistory);
      } else {
        setShowIntro(true);
        setIntroStep(0);
      }
    } catch (err) {
      console.error("Failed to start game:", err);
      setError("Failed to start game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRestart() {
    setIsLoading(true);
    setMessages([]);
    try {
      const preferredClass: ArchetypeKey =
        (gameState?.character?.class?.toLowerCase() as ArchetypeKey) ||
        (selectedClass as ArchetypeKey) ||
        'fighter';
      setSelectedClass(preferredClass);
      const freshState = await resetGame(preferredClass);
      setMultiplayerSession(null);
      setGameState(freshState);
      setShowIntro(true);
      setIntroStep(0);
    } catch (err) {
      console.error("Restart failed", err);
      setError("Failed to restart game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTurn(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading || !gameState || !multiplayerCanAct) return;
    await executeTurn(input, gameState);
  }

  async function handleCreateSession() {
    if (!gameState || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await createMultiplayerFromCurrentGame();
      applyMultiplayerSnapshot(snapshot);
      setViewMode('visual');
    } catch (err) {
      console.error('Create multiplayer session failed', err);
      setError('Failed to create session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoinSession() {
    if (isLoading) return;
    if (!canJoinParty) {
      setError('Party codes are 6 characters. Copy the full code from the host browser.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await joinMultiplayerByCode(normalizedJoinCode, selectedClass || 'fighter');
      applyMultiplayerSnapshot(snapshot);
      setJoinCode('');
      setShowIntro(false);
      setViewMode('visual');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message || 'Failed to join session. Check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyPartyCode() {
    if (!multiplayerSession?.code) return;
    try {
      await navigator.clipboard.writeText(multiplayerSession.code);
      setCopiedPartyCode(true);
      window.setTimeout(() => setCopiedPartyCode(false), 1500);
    } catch (err) {
      console.error('Copy party code failed', err);
      setError('Could not copy the party code. Select the code and copy it manually.');
    }
  }

  // 1. CHARACTER SELECT SCREEN
  if (!gameState) {
    return (
      <CharacterSelectScreen
        selectedClass={selectedClass}
        onSelectClass={(key) => { setSelectedClass(key); setError(null); }}
        isLoading={isLoading}
        error={error}
        joinCode={joinCode}
        onJoinCodeChange={(value) => { setJoinCode(normalizeSessionCodeInput(value)); setError(null); }}
        onJoin={handleJoinSession}
        canJoin={canJoinParty}
        saveSummary={saveSummary}
        isNewRun={isNewRun}
        onStart={handleStart}
      />
    );
  }

  // 2. PROLOGUE OVERLAY
  if (showIntro) {
    return (
      <PrologueOverlay
        steps={PROLOGUE_STEPS}
        step={introStep}
        onAdvance={() => setIntroStep(prev => prev + 1)}
        onFinish={() => setShowIntro(false)}
      />
    );
  }

  const isDead = gameState.hp <= 0;

  const handleMainMenu = () => {
    router.push('/splash');
  };

  return (
    <main className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">

      <MobileHeader
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onMainMenu={handleMainMenu}
        onRestart={handleRestart}
        isLoading={isLoading}
        onOpenStats={() => { setIsLeftSidebarOpen(true); setIsRightSidebarOpen(false); }}
        onOpenSpells={() => { setIsRightSidebarOpen(true); setIsLeftSidebarOpen(false); }}
      />

      {/* LEFT: Sidebar (Desktop) */}
      {viewMode === 'text' && (
        <div className="w-[320px] hidden md:block h-full border-r border-slate-800">
          <LeftSidebar state={gameState} onItemUse={handleItemUse} />
        </div>
      )}

      {/* CENTER: Chat Area */}
      <div className={`flex-1 flex flex-col w-full p-4 pt-16 md:pt-4 relative h-full ${
        viewMode === 'visual' ? 'max-w-full' : 'max-w-4xl mx-auto'
      }`}>
        <DesktopTopBar
          viewMode={viewMode}
          onToggleViewMode={toggleViewMode}
          onMainMenu={handleMainMenu}
          onRestart={handleRestart}
          isLoading={isLoading}
        />

        <PartyBar
          session={multiplayerSession
            ? { code: multiplayerSession.code, playerCount: multiplayerSession.players.length }
            : null}
          actionDisabledReason={actionDisabledReason}
          copiedPartyCode={copiedPartyCode}
          onCopyPartyCode={handleCopyPartyCode}
          joinCode={joinCode}
          onJoinCodeChange={(value) => { setJoinCode(normalizeSessionCodeInput(value)); setError(null); }}
          onCreate={handleCreateSession}
          onJoin={handleJoinSession}
          canJoin={canJoinParty}
          isLoading={isLoading}
        />
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        <div className={`flex-1 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-700 ${
          viewMode === 'visual' ? 'p-0 pb-4' : 'p-4 pb-32'
        }`}>
          {/* Visual Dungeon Shell (Phase 0) */}
          {viewMode === 'visual' && !isDead && (
            <VisualDungeonShell
              gameState={gameState}
              viewModel={visualViewModel}
              isLoading={isLoading}
              onCommand={(command) => executeTurn(command, gameState)}
              onOpenFullInventory={() => setIsInventoryOpen(true)}
            />
          )}

          {/* Text Mode Messages */}
          {viewMode === 'text' && messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] p-4 rounded-lg leading-relaxed bg-amber-900/40 border border-amber-800 text-amber-100 rounded-tr-none whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] p-4 rounded-lg leading-relaxed bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-lg">
                  <div className="whitespace-pre-wrap text-slate-100">
                    {m.summary}
                    {m.flavor && (
                      <span className="text-slate-300 italic"> {m.flavor}</span>
                    )}
                  </div>
                  {m.rolls && m.rolls.length > 0 && <DiceRollRow rolls={m.rolls} />}
                </div>
              </div>
            );
          })}
          {isLoading && <div className="text-slate-500 text-sm animate-pulse pl-4">The DM is thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA — see components/TurnInputArea.tsx */}
        <TurnInputArea
          isDead={isDead}
          deathCountdown={deathCountdown}
          viewMode={viewMode}
          isAdvancedInputOpen={isAdvancedInputOpen}
          onToggleAdvanced={() => setIsAdvancedInputOpen(prev => !prev)}
          input={input}
          onInputChange={setInput}
          onSubmit={handleTurn}
          onClear={() => { setInput(''); focusInput(); }}
          inputRef={inputRef}
          isLoading={isLoading}
          canAct={multiplayerCanAct}
          actionDisabledReason={actionDisabledReason}
          slotSummary={lastSlots}
          hints={
            <CommandHints
              gameState={gameState}
              onCommand={(cmd) => executeTurn(cmd, gameState)}
              isLoading={isLoading || !multiplayerCanAct}
            />
          }
        />
      </div>

      {/* RIGHT: Sidebar (Desktop) */}
      {viewMode === 'text' && (
        <div className="w-[350px] hidden md:block h-full border-l border-slate-800">
          <RightSidebar state={gameState} onInsertCommand={(cmd) => { setInput(cmd); focusInput(); }} />
        </div>
      )}

      <MobileSidebarDrawer
        isOpen={isLeftSidebarOpen}
        side="left"
        label="Character stats"
        onClose={() => setIsLeftSidebarOpen(false)}
      >
        <LeftSidebar state={gameState} onItemUse={handleItemUse} />
      </MobileSidebarDrawer>

      <MobileSidebarDrawer
        isOpen={isRightSidebarOpen}
        side="right"
        label="Spells"
        onClose={() => setIsRightSidebarOpen(false)}
      >
        <RightSidebar
          state={gameState}
          onInsertCommand={(cmd) => {
            setInput(cmd);
            setIsRightSidebarOpen(false);
            focusInput();
          }}
        />
      </MobileSidebarDrawer>

      {/* Inventory Modal */}
      <InventoryModal
        gameState={gameState}
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onAction={(command) => {
          setInput(command);
          setIsInventoryOpen(false);
          focusInput();
          setTimeout(() => {
            if (command.trim() && gameState) {
              executeTurn(command, gameState).catch(console.error);
            }
          }, 100);
        }}
        isProcessing={isLoading || !multiplayerCanAct}
      />
    </main>
  );
}
