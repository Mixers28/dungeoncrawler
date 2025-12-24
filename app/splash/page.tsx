'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skull, Play, Trophy } from 'lucide-react'
import { sanitizeString } from '../../lib/leaderboard'

// Initialize state from localStorage
const getInitialState = () => {
  if (typeof window === 'undefined') return { hasSavedGame: false, characterName: null }
  
  const name = localStorage.getItem('dungeon_portal_character')
  const savedGameJson = localStorage.getItem('dungeon_portal_save')
  
  let isAlive = false
  
  if (savedGameJson && name) {
    try {
      const savedState = JSON.parse(savedGameJson)
      isAlive = savedState.hp > 0
    } catch (e) {
      console.error('Corrupted save data, clearing:', e)
      localStorage.removeItem('dungeon_portal_save')
    }
  }
  
  return { hasSavedGame: isAlive, characterName: name }
}

export default function SplashPage() {
  const router = useRouter()
  const initialState = getInitialState()
  const [hasSavedGame] = useState(initialState.hasSavedGame)
  const [characterName] = useState<string | null>(initialState.characterName)

  const handleContinue = () => {
    router.push('/')
  }

  const handleNewRun = () => {
    // Clear saved game but keep character name for now
    // User will select character in login flow
    localStorage.removeItem('dungeon_portal_save')
    router.push('/login')
  }

  const handleViewLeaderboard = () => {
    router.push('/landing')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 p-6 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 opacity-30">
        <img 
          src="/prologue/gate.png" 
          alt="Dungeon Gate Background"
          className="w-full h-full object-cover blur-sm"
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.08),transparent_60%)]" />
      
      {/* Content Card */}
      <div className="relative z-10 w-full max-w-lg space-y-6 rounded-xl border border-amber-900/30 bg-slate-900/90 backdrop-blur-sm p-8 shadow-2xl shadow-amber-900/20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Skull className="w-10 h-10 text-amber-500 animate-in zoom-in duration-500" />
          <h1 className="text-4xl font-black text-amber-500 tracking-tight animate-in fade-in duration-700 delay-100">
            Dungeon Portal
          </h1>
          <Skull className="w-10 h-10 text-amber-500 animate-in zoom-in duration-500 delay-200" />
        </div>

        {characterName && (
          <div className="text-center text-slate-400 mb-6 animate-in fade-in duration-500 delay-300">
            <p className="text-sm">Welcome back,</p>
            <p className="text-xl font-bold text-amber-400">{sanitizeString(characterName)}</p>
          </div>
        )}

        <div className="space-y-4 animate-in fade-in duration-500 delay-400">
          {hasSavedGame && (
            <button
              onClick={handleContinue}
              aria-label="Continue your saved adventure"
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold py-4 px-6 rounded-lg transition-all shadow-lg shadow-amber-900/50 hover:shadow-amber-900/70 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-5 h-5" />
              Continue Adventure
            </button>
          )}

          <button
            onClick={handleNewRun}
            aria-label="Start a new run with a new character"
            className="w-full flex items-center justify-center gap-3 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur text-slate-200 font-bold py-4 px-6 rounded-lg transition-all border border-slate-700/50 hover:border-amber-700/50 hover:shadow-lg hover:shadow-slate-900/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Skull className="w-5 h-5" />
            New Run
          </button>

          <button
            onClick={handleViewLeaderboard}
            aria-label="View the leaderboard"
            className="w-full flex items-center justify-center gap-3 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur text-slate-200 font-bold py-4 px-6 rounded-lg transition-all border border-slate-700/50 hover:border-amber-700/50 hover:shadow-lg hover:shadow-slate-900/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Trophy className="w-5 h-5" />
            View Leaderboard
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/50 text-center text-xs text-slate-500 animate-in fade-in duration-500 delay-500">
          <p>A dark dungeon crawler powered by AI narration</p>
        </div>
      </div>
    </div>
  )
}
