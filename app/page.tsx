'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Skull, ArrowRight, BookOpen, X, Eye, EyeOff } from 'lucide-react';
import type { GameState, LogEntry, NarrationMode } from '../lib/game-schema';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightSidebar } from '../components/RightSidebar';
import { BattlefieldView } from '../components/BattlefieldView';
import { ActionBar } from '../components/ActionBar';
import { NarrationLog } from '../components/NarrationLog';
import { createNewGame, processTurn, resetGame } from './actions';
import { ARCHETYPES, ArchetypeKey } from './characters';
import { saveScore } from '../lib/leaderboard';
import { createClient } from '@/utils/supabase/client';

type UserMessage = { role: 'user'; content: string };
type AssistantMessage = { role: 'assistant'; summary: string; flavor?: string; mode?: NarrationMode; createdAt?: string };
type Message = UserMessage | AssistantMessage;

const DEATH_REDIRECT_DELAY_MS = 3000;

// --- PROLOGUE CONTENT (Local Static Assets) ---
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
  const [input, setInput] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDying, setIsDying] = useState(false);
  const [deathCountdown, setDeathCountdown] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<ArchetypeKey | null>('fighter');
  const [error, setError] = useState<string | null>(null);
  const [lastSlots, setLastSlots] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  
  // UI STATES
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'visual'>('text');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const handleDeath = useCallback((state: GameState) => {
    if (isDying) return; // Prevent duplicate calls
    setIsDying(true);
    setDeathCountdown(3);
    saveScore(state, 'loss', userId || undefined);
    localStorage.removeItem('dungeon_portal_save');
    
    // Countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setDeathCountdown(prev => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Redirect after delay
    setTimeout(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      router.push('/splash');
    }, DEATH_REDIRECT_DELAY_MS);
  }, [isDying, router, userId]);

  // Quick action handler for ActionBar
  const handleQuickAction = useCallback((action: string) => {
    if (isLoading || !gameState || isDying) return;
    
    const commandMap: Record<string, string> = {
      attack: 'attack',
      cast: 'cast',
      item: 'use potion',
      run: 'run away',
    };
    
    const command = commandMap[action];
    if (command) {
      setInput(command);
      // Trigger form submission after a brief delay
      setTimeout(async () => {
        if (!command.trim() || isLoading || !gameState) return;
        const userAction = command;
        setInput('');
        focusInput();
        setIsLoading(true);
        setMessages(prev => [...prev, { role: 'user', content: userAction }]);
        
        try {
          const { newState, logEntry } = await processTurn(gameState, userAction);
          setGameState(newState);
          
          if (newState.hp <= 0 && gameState.hp > 0) {
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                summary: logEntry.summary,
                flavor: logEntry.flavor,
                mode: logEntry.mode,
                createdAt: logEntry.createdAt,
              }
            ]);
            localStorage.setItem('dungeon_portal_save', JSON.stringify(newState));
            setTimeout(() => handleDeath(newState), 500);
            return;
          }
          
          localStorage.setItem('dungeon_portal_save', JSON.stringify(newState));
          if (newState?.spellSlots) {
            const slotText = Object.entries(newState.spellSlots)
              .map(([lvl, data]) => `${lvl.replace('_', ' ')} ${data.current}/${data.max}`)
              .join(' · ');
            setLastSlots(slotText);
          }
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              summary: logEntry.summary,
              flavor: logEntry.flavor,
              mode: logEntry.mode,
              createdAt: logEntry.createdAt,
            }
          ]);
        } catch (error) {
          console.error("Turn Error:", error);
          setError("Failed to process turn. Please try again.");
        } finally {
          setIsLoading(false);
          focusInput();
        }
      }, 50);
    }
  }, [isLoading, gameState, isDying, handleDeath, focusInput]);

  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'text' ? 'visual' : 'text';
    setViewMode(newMode);
    localStorage.setItem('dungeon_portal_view_mode', newMode);
  }, [viewMode]);

  // Auto-load saved game on mount
  useEffect(() => {
    // Get current user session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
      }
    })
    
    // Load view mode preference
    const savedViewMode = localStorage.getItem('dungeon_portal_view_mode');
    if (savedViewMode === 'visual' || savedViewMode === 'text') {
      setViewMode(savedViewMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard shortcuts for combat actions
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in input and combat is active
      if (document.activeElement === inputRef.current) return;
      if (!gameState?.isCombatActive) return;
      if (isLoading || isDying) return;
      
      const key = e.key.toLowerCase();
      if (key === 'a') handleQuickAction('attack');
      else if (key === 'c') handleQuickAction('cast');
      else if (key === 'i') handleQuickAction('item');
      else if (key === 'r') handleQuickAction('run');
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState?.isCombatActive, isLoading, isDying, handleQuickAction]);

  useEffect(() => {
    const characterName = localStorage.getItem('dungeon_portal_character');
    if (!characterName) {
      // No character name, redirect to splash
      router.push('/splash');
      return;
    }

    // Try to load existing save
    const savedGameJson = localStorage.getItem('dungeon_portal_save');
    if (savedGameJson) {
      try {
        const savedState = JSON.parse(savedGameJson);
        
        // Check if player is dead - redirect to splash
        if (savedState.hp <= 0) {
          handleDeath(savedState);
          return;
        }
        
        setGameState(savedState);
        
        // Restore messages from log
        const restoredLog: Message[] = (savedState.log || []).map((entry: LogEntry) => ({
          role: 'assistant',
          summary: entry.summary,
          flavor: entry.flavor,
          mode: entry.mode,
          createdAt: entry.createdAt,
        }));
        
        if (restoredLog.length > 0) {
          setMessages(restoredLog);
        }
        
        // Set the selected class from saved state
        if (savedState.character?.class) {
          setSelectedClass(savedState.character.class.toLowerCase() as ArchetypeKey);
        }
      } catch (e) {
        console.error('Failed to load saved game:', e);
      }
    }
  }, [router, handleDeath]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Keep the input active whenever we finish loading or messages change.
  useEffect(() => {
    if (!isLoading) focusInput();
  }, [isLoading, messages.length, focusInput]);

  useEffect(() => {
    if (gameState?.spellSlots) {
      const slotText = Object.entries(gameState.spellSlots)
        .map(([lvl, data]) => `${lvl.replace('_', ' ')} ${data.current}/${data.max}`)
        .join(' · ');
      setLastSlots(slotText);
    }
  }, [gameState]);

async function handleStart() {
    setIsLoading(true);
    try {
      if (!selectedClass) {
        setError("Select a class to begin.");
        setIsLoading(false);
        return;
      }

      // Try to load existing save from localStorage
      const savedGameJson = localStorage.getItem('dungeon_portal_save');
      let existingSave = null;
      if (savedGameJson) {
        try {
          existingSave = JSON.parse(savedGameJson);
        } catch (e) {
          console.error('Failed to parse saved game:', e);
        }
      }

      const initialState = await createNewGame({ 
        archetypeKey: selectedClass as ArchetypeKey, 
        forceNew: !existingSave,
        existingSave: existingSave 
      });
      setGameState(initialState);
      
      // Save to localStorage
      localStorage.setItem('dungeon_portal_save', JSON.stringify(initialState));
      
      // LOGIC FIX: Restore the Chat History from the Database
      const restoredLog: Message[] = (initialState.log || []).map((entry: LogEntry) => ({
        role: 'assistant',
        summary: entry.summary,
        flavor: entry.flavor,
        mode: entry.mode,
        createdAt: entry.createdAt,
      }));

      if (restoredLog.length > 0) {
        setMessages(restoredLog);
      } else if (initialState.narrativeHistory && initialState.narrativeHistory.length > 0) {
        // Fallback: map previous narrativeHistory strings into summary-only messages
        const restoredHistory: Message[] = initialState.narrativeHistory.map(entry => ({
          role: 'assistant',
          summary: entry
        }));
        setMessages(restoredHistory);
      } else {
        // If no history exists (New Game), show the intro or default text
        if (initialState.narrativeHistory.length === 0) {
          setShowIntro(true);
          setIntroStep(0);
        } else {
          setMessages([{ role: 'assistant', summary: initialState.lastActionSummary || "The adventure continues..." }]);
        }
      }

    } catch (error) {
      console.error("Failed to start game:", error);
      setError("Failed to start game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }
  async function handleRestart() {
    setIsLoading(true);
    setMessages([]);
    try {
      // Try to reuse current character class or selectedClass; default to fighter
      const preferredClass: ArchetypeKey =
        (gameState?.character?.class?.toLowerCase() as ArchetypeKey) ||
        (selectedClass as ArchetypeKey) ||
        'fighter';
      setSelectedClass(preferredClass);
      const freshState = await resetGame(preferredClass);
      setGameState(freshState);
      
      // Save to localStorage
      localStorage.setItem('dungeon_portal_save', JSON.stringify(freshState));
      
      setShowIntro(true);
      setIntroStep(0);
    } catch (error) {
      console.error("Restart failed", error);
      setError("Failed to restart game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTurn(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading || !gameState) return;

    const userAction = input;
    setInput('');
    focusInput();
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userAction }]);

    try {
      const { newState, logEntry } = await processTurn(gameState, userAction);
      setGameState(newState);
      
      // Check if player just died
      if (newState.hp <= 0 && gameState.hp > 0) {
        // Show death message then handle death
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            summary: logEntry.summary,
            flavor: logEntry.flavor,
            mode: logEntry.mode,
            createdAt: logEntry.createdAt,
          }
        ]);
        
        handleDeath(newState);
        setIsLoading(false);
        return;
      }
      
      // Save to localStorage if still alive
      if (newState.hp > 0) {
        localStorage.setItem('dungeon_portal_save', JSON.stringify(newState));
      }
      
      if (newState?.spellSlots) {
        const slotText = Object.entries(newState.spellSlots)
          .map(([lvl, data]) => `${lvl.replace('_', ' ')} ${data.current}/${data.max}`)
          .join(' · ');
        setLastSlots(slotText);
      }
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          summary: logEntry.summary,
          flavor: logEntry.flavor,
          mode: logEntry.mode,
          createdAt: logEntry.createdAt,
        }
      ]);
    } catch (error) {
      console.error("Turn Error:", error);
      setError("Failed to process turn. Please try again.");
    } finally {
      setIsLoading(false);
      focusInput();
    }
  }

  // 1. LOADING SCREEN
  if (!gameState) {
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
                  onClick={() => { setSelectedClass(key as ArchetypeKey); setError(null); }}
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
            <div className="flex justify-end mt-6">
              <button 
                onClick={handleStart} 
                disabled={isLoading}
                className="bg-amber-600 hover:bg-amber-700 text-slate-900 text-lg font-bold py-3 px-6 rounded transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20 flex items-center gap-3"
              >
                {isLoading ? "Loading..." : "Enter the Realm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. PROLOGUE OVERLAY
  if (showIntro) {
    const currentSlide = PROLOGUE_STEPS[introStep];
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-1000">
        <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="h-64 md:h-96 w-full relative">
            <img src={currentSlide.image} alt="Prologue" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
          </div>
          <div className="p-8 md:p-12 text-center space-y-8">
            <h2 className="text-2xl md:text-3xl font-serif text-amber-500 italic">Part {introStep + 1}</h2>
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">{currentSlide.text}</p>
            <button
              onClick={() => {
                if (introStep < PROLOGUE_STEPS.length - 1) setIntroStep(prev => prev + 1);
                else setShowIntro(false);
              }}
              className="bg-slate-800 hover:bg-amber-900 border border-slate-700 hover:border-amber-700 text-white px-8 py-3 rounded-full transition-all flex items-center gap-2 mx-auto"
            >
              {introStep < PROLOGUE_STEPS.length - 1 ? "Next" : "Begin Adventure"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDead = gameState.hp <= 0;

  const handleMainMenu = () => {
    // Save current game state if alive
    if (gameState.hp > 0) {
      localStorage.setItem('dungeon_portal_save', JSON.stringify(gameState));
    }
    // Redirect to splash
    router.push('/splash');
  };

  return (
    <main className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      
      {/* MOBILE HEADER (Visible only on small screens) */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-10">
        <span className="font-bold text-amber-500">Dungeon Portal</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMainMenu}
            disabled={isLoading}
            aria-label="Return to main menu"
            className="text-xs bg-slate-700 text-slate-200 font-bold px-3 py-1 rounded disabled:opacity-50"
          >
            Menu
          </button>
          <button
            onClick={handleRestart}
            disabled={isLoading}
            aria-label="Start a new run"
            className="text-xs bg-amber-700 text-slate-900 font-bold px-3 py-1 rounded disabled:opacity-50"
          >
            New Run
          </button>
          <button
            onClick={() => { setIsLeftSidebarOpen(true); setIsRightSidebarOpen(false); }}
            aria-label="Open character stats sidebar"
            className="text-xs bg-slate-800 text-slate-200 font-semibold px-3 py-1 rounded"
          >
            Stats
          </button>
          <button
            onClick={() => { setIsRightSidebarOpen(true); setIsLeftSidebarOpen(false); }}
            aria-label="Open spells sidebar"
            className="text-xs bg-slate-800 text-slate-200 font-semibold px-3 py-1 rounded"
          >
            Spells
          </button>
        </div>
      </div>

      {/* LEFT: Sidebar (Desktop) */}
      <div className="w-[320px] hidden md:block h-full border-r border-slate-800">
        <LeftSidebar state={gameState} />
      </div>

      {/* LEFT: Chat Area (Padded top for mobile header) */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 pt-16 md:pt-4 relative h-full">
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between mb-2 text-sm text-slate-400">
          <span className="font-semibold text-amber-500">Dungeon Portal</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleViewMode}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded flex items-center gap-2 transition-colors"
              title={`Switch to ${viewMode === 'text' ? 'visual' : 'text'} mode`}
            >
              {viewMode === 'visual' ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="hidden lg:inline">{viewMode === 'text' ? 'Visual' : 'Text'}</span>
            </button>
            <button
              onClick={handleMainMenu}
              disabled={isLoading}
              aria-label="Return to main menu and save progress"
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Main Menu
            </button>
            <button
              onClick={handleRestart}
              disabled={isLoading}
              aria-label="Start a new run with same character"
              className="bg-amber-700 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Resetting..." : "New Run"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-4 scrollbar-thin scrollbar-thumb-slate-700 pb-32">
          {/* Visual Combat Mode */}
          {viewMode === 'visual' && gameState?.isCombatActive && (
            <div className="space-y-4">
              <BattlefieldView
                entities={gameState.nearbyEntities}
                playerHp={gameState.hp}
                playerMaxHp={gameState.maxHp}
                playerAc={gameState.ac}
                playerName={gameState.character.name}
                isCombatActive={gameState.isCombatActive}
                onEntityClick={(entity) => {
                  if (entity.status === 'alive') {
                    setInput(`attack ${entity.name.toLowerCase()}`);
                    focusInput();
                  }
                }}
              />
              
              <ActionBar
                onAction={handleQuickAction}
                disabled={isDead || isDying}
                isProcessing={isLoading}
                canCastSpell={(gameState.knownSpells?.length || 0) > 0}
                hasItems={gameState.inventory.some(i => i.type === 'potion')}
              />
              
              <NarrationLog
                entries={gameState.log}
                maxEntries={8}
                showMode
                compact
              />
            </div>
          )}
          
          {/* Text Mode Messages */}
          {(viewMode === 'text' || !gameState?.isCombatActive) && messages.map((m, i) => {
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
                </div>
              </div>
            );
          })}
          {isLoading && <div className="text-slate-500 text-sm animate-pulse pl-4">The DM is thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="mt-4">
          {isDead ? (
            <div className="bg-red-950/50 border border-red-900 p-6 rounded-lg flex flex-col items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="flex items-center gap-3 text-red-500">
                <Skull size={32} />
                <h2 className="text-3xl font-black tracking-widest uppercase">You Died</h2>
                <Skull size={32} />
              </div>
              <p className="text-red-300/70 italic">Your journey ends here. {deathCountdown !== null && deathCountdown > 0 ? `Redirecting in: ${deathCountdown}` : 'Redirecting...'}</p>
            </div>
          ) : (
            <form onSubmit={handleTurn} className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 bg-slate-900 border border-slate-700 rounded p-4 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                placeholder="What do you do?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              {lastSlots && <div className="hidden md:flex items-center text-xs text-slate-400 px-2">{lastSlots}</div>}
              <button type="submit" disabled={isLoading || !input.trim()} className="bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold px-8 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                ACT
              </button>
              <button
                type="button"
                onClick={() => { setInput(''); focusInput(); }}
                disabled={isLoading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Clear input"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT: Sidebar (Desktop) */}
      <div className="w-[350px] hidden md:block h-full border-l border-slate-800">
        <RightSidebar state={gameState} onInsertCommand={(cmd) => { setInput(cmd); focusInput(); }} />
      </div>

      {/* MOBILE: Left Drawer */}
      {isLeftSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-start">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsLeftSidebarOpen(false)} />
          <div className="relative w-[85%] max-w-[350px] h-full bg-slate-950 border-r border-slate-800 shadow-2xl animate-in slide-in-from-left duration-300">
            <button onClick={() => setIsLeftSidebarOpen(false)} className="absolute top-4 right-4 z-50 bg-slate-900 p-2 rounded-full text-slate-300 border border-slate-700">
              <X size={20} />
            </button>
            <LeftSidebar state={gameState} />
          </div>
        </div>
      )}

      {/* MOBILE: Right Drawer */}
      {isRightSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsRightSidebarOpen(false)} />
          <div className="relative w-[85%] max-w-[350px] h-full bg-slate-950 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300">
            <button onClick={() => setIsRightSidebarOpen(false)} className="absolute top-4 right-4 z-50 bg-slate-900 p-2 rounded-full text-slate-300 border border-slate-700">
              <X size={20} />
            </button>
            <RightSidebar
              state={gameState}
              onInsertCommand={(cmd) => {
                setInput(cmd);
                setIsRightSidebarOpen(false);
                focusInput();
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
