'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if character name exists
    const characterName = localStorage.getItem('dungeon_portal_character')
    if (characterName) {
      // Has character name, go to game
      router.push('/')
    } else {
      // No character name, go to login
      router.push('/login')
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
      <div className="w-full max-w-lg space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-black text-amber-500">Dungeon Portal</h1>
        <p className="text-slate-400">
          Loading...
        </p>
      </div>
    </div>
  )
}
