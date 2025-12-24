'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [characterName, setCharacterName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    const trimmedName = characterName.trim()
    if (!trimmedName) {
      alert('Please enter a character name')
      return
    }
    
    setLoading(true)
    
    // Store character name in localStorage
    localStorage.setItem('dungeon_portal_character', trimmedName)
    
    // Redirect to game
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 p-8 bg-slate-900 rounded-lg border border-slate-800">
        <h1 className="text-2xl font-bold text-amber-500 mb-6">Dungeon Portal</h1>
        <p className="text-slate-400 text-sm mb-4">Enter your character name to begin or continue your adventure.</p>
        
        <div>
          <label className="block text-sm font-medium mb-1">Character Name</label>
          <input 
            type="text" 
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
            placeholder="Enter your name..."
            required 
            autoFocus
          />
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 p-2 rounded font-bold transition-all"
          >
            {loading ? '...' : 'Enter the Dungeon'}
          </button>
        </div>
      </form>
    </div>
  )
}
