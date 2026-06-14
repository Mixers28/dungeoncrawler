'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Skull } from 'lucide-react'

export function Hero() {
  const router = useRouter()

  function handleStartRun() {
    router.push('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-6 py-16 px-4">
      <div className="flex items-center gap-3 mb-4">
        <Skull className="w-12 h-12 text-amber-500" />
        <h1 className="text-5xl md:text-6xl font-black text-amber-500">
          Dungeon Portal
        </h1>
      </div>
      
      <p className="text-xl md:text-2xl text-slate-300 max-w-2xl">
        Descend into darkness. Survive the depths.
        <br />
        <span className="text-amber-400">Claim your fortune.</span>
      </p>

      <p className="text-slate-400 max-w-xl">
        AI-driven dungeon crawler powered by D&D 5e rules. 
        Choose your class, battle monsters, collect loot, and see how deep you can go.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <button
          onClick={handleStartRun}
          className="group flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold px-8 py-4 rounded-lg transition-all text-lg"
          aria-label="Start your dungeon run"
        >
          Start Your Run
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        
        <button
          onClick={() => {
            const leaderboardEl = document.getElementById('leaderboard')
            leaderboardEl?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-8 py-4 rounded-lg transition-all text-lg"
          aria-label="Scroll to leaderboard"
        >
          View Leaderboard
        </button>
      </div>
    </div>
  )
}
