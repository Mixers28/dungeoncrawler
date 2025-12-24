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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 p-6">
      <div className="w-full max-w-lg space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Skull className="w-10 h-10 text-amber-500" />
          <h1 className="text-4xl font-black text-amber-500">Dungeon Portal</h1>
          <Skull className="w-10 h-10 text-amber-500" />
        </div>

        {characterName && (
          <div className="text-center text-slate-400 mb-6">
            <p className="text-sm">Welcome back,</p>
            <p className="text-xl font-bold text-amber-400">{sanitizeString(characterName)}</p>
          </div>
        )}

        <div className="space-y-4">
          {hasSavedGame && (
            <button
              onClick={handleContinue}
              aria-label="Continue your saved adventure"
              className="w-full flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold py-4 px-6 rounded-lg transition-colors shadow-lg"
            >
              <Play className="w-5 h-5" />
              Continue Adventure
            </button>
          )}

          <button
            onClick={handleNewRun}
            aria-label="Start a new run with a new character"
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-4 px-6 rounded-lg transition-colors border border-slate-700"
          >
            <Skull className="w-5 h-5" />
            New Run
          </button>

          <button
            onClick={handleViewLeaderboard}
            aria-label="View the leaderboard"
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-4 px-6 rounded-lg transition-colors border border-slate-700"
          >
            <Trophy className="w-5 h-5" />
            View Leaderboard
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
          <p>A dark dungeon crawler powered by AI narration</p>
        </div>
      </div>
    </div>
  )
}
