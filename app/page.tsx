'use client';

import { useState, useRef, useEffect } from 'react';
import { readStreamableValue } from 'ai/rsc';
import { useRouter } from 'next/navigation';
import { Skull, ArrowRight, BookOpen, Menu, X } from 'lucide-react'; // Added Menu, X
import { GameState } from '../lib/game-schema';
import { GameSidebar } from '../components/GameSidebar';
import { createNewGame, processTurn, resetGame } from './actions';

type Message = { role: 'user' | 'assistant'; content: string };

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
  
  // UI STATES
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Toggle

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

async function handleStart() {
    setIsLoading(true);
    try {
      const initialState = await createNewGame();
      setGameState(initialState);
      
      // LOGIC FIX: Restore the Chat History from the Database
      if (initialState.narrativeHistory && initialState.narrativeHistory.length > 0) {
        // Map the saved string history back into chat bubbles
        const restoredHistory = initialState.narrativeHistory.map(entry => ({
          role: 'assistant' as const,
          content: entry
        }));
        setMessages(restoredHistory);
      } else {
        // If no history exists (New Game), show the intro or default text
        if (initialState.narrativeHistory.length === 0) {
          setShowIntro(true);
          setIntroStep(0);
        } else {
          setMessages([{ role: 'assistant', content: initialState.lastActionSummary || "The adventure continues..." }]);
        }
      }

    } catch (error) {
      console.error("Failed to start game:", error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }
  async function handleRestart() {
    setIsLoading(true);
    setMessages([]);
    try {
      const freshState = await resetGame();
      setGameState(freshState);
      setShowIntro(true);
      setIntroStep(0);
    } catch (error) {
      console.error("Restart failed", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTurn(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading || !gameState) return;

    const userAction = input;
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userAction }]);

    try {
      const { newState, narrativeStream } = await processTurn(gameState, userAction);
      setGameState(newState);
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      let fullContent = '';
      for await (const delta of readStreamableValue(narrativeStream)) {
        fullContent += delta;
        setMessages(prev => {
          const newMsg = [...prev];
          newMsg[newMsg.length - 1].content = fullContent;
          return newMsg;
        });
      }
    } catch (error) {
      console.error("Turn Error:", error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }

  // 1. LOADING SCREEN
  if (!gameState) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <button 
          onClick={handleStart} 
          disabled={isLoading}
          className="bg-amber-600 hover:bg-amber-700 text-2xl font-bold py-4 px-8 rounded transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20 flex items-center gap-3"
        >
          <BookOpen size={24} />
          {isLoading ? "Loading World..." : "Enter the Realm"}
        </button>
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

  return (
    <main className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      
      {/* MOBILE HEADER (Visible only on small screens) */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-10">
        <span className="font-bold text-amber-500">Dungeon Portal</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            disabled={isLoading}
            className="text-xs bg-amber-700 text-slate-900 font-bold px-3 py-1 rounded disabled:opacity-50"
          >
            New Run
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-300">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* LEFT: Chat Area (Padded top for mobile header) */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 pt-16 md:pt-4 relative h-full">
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between mb-2 text-sm text-slate-400">
          <span className="font-semibold text-amber-500">Dungeon Portal</span>
          <button
            onClick={handleRestart}
            disabled={isLoading}
            className="bg-amber-700 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Resetting..." : "New Run"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-4 scrollbar-thin scrollbar-thumb-slate-700 pb-32">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-lg leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-amber-900/40 border border-amber-800 text-amber-100 rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-lg'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
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
              <p className="text-red-300/70 italic">Your journey ends here.</p>
              <button onClick={handleRestart} disabled={isLoading} className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-8 rounded transition-colors shadow-lg shadow-red-900/50">
                {isLoading ? "Resurrecting..." : "Start New Run"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleTurn} className="flex gap-2">
              <input
                className="flex-1 bg-slate-900 border border-slate-700 rounded p-4 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"
                placeholder="What do you do?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold px-8 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                ACT
              </button>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT: Sidebar (Responsive) */}
      {/* 1. DESKTOP: Always visible on right */}
      <div className="w-[350px] hidden md:block h-full border-l border-slate-800">
        <GameSidebar state={gameState} />
      </div>

      {/* 2. MOBILE: Slide-over Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop (Click to close) */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          
          {/* Drawer */}
          <div className="relative w-[85%] max-w-[350px] h-full bg-slate-950 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 z-50 bg-slate-900 p-2 rounded-full text-slate-300 border border-slate-700">
              <X size={20} />
            </button>
            <GameSidebar state={gameState} />
          </div>
        </div>
      )}
    </main>
  );
}
