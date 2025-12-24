'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { UserCircle, Ghost } from 'lucide-react'

export default function LoginPage() {
  const [characterName, setCharacterName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if already signed in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // User already authenticated, just need character name
        const savedName = localStorage.getItem('dungeon_portal_character')
        if (savedName) {
          router.push('/splash')
        }
      }
    })
  }, [supabase, router])

  async function handleAnonymousLogin() {
    setLoading(true)
    setError(null)
    
    try {
      // Try anonymous sign-in
      const { data, error: authError } = await supabase.auth.signInAnonymously()
      
      if (authError) {
        console.error('Anonymous sign-in error:', authError)
        
        // Check if it's a configuration issue
        if (authError.message?.includes('Anonymous sign-ins are disabled') || 
            authError.message?.includes('not enabled')) {
          setError('Anonymous auth is not configured. Please use Named Character instead or enable anonymous auth in Supabase.')
        } else {
          setError(`Authentication failed: ${authError.message}`)
        }
        setLoading(false)
        return
      }

      if (!data.user) {
        setError('Authentication failed. Please try Named Character instead.')
        setLoading(false)
        return
      }

      // Generate a default character name for anonymous users
      const anonName = `Wanderer_${data.user.id.slice(0, 6)}`
      
      // Clear any existing save (new run starts fresh)
      localStorage.removeItem('dungeon_portal_save')
      
      // Store character name in localStorage
      localStorage.setItem('dungeon_portal_character', anonName)
      
      // Redirect to game
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Unexpected error during anonymous sign-in:', error)
      setError('Anonymous auth unavailable. Please use Named Character instead.')
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    const trimmedName = characterName.trim()
    if (!trimmedName) {
      setError('Please enter a character name')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Try to get or create anonymous session for leaderboard tracking
      // This is optional - game works without it using localStorage fallback
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          // Attempt anonymous sign-in (will fail gracefully if not configured)
          await supabase.auth.signInAnonymously()
        }
      } catch (authError) {
        // Anonymous auth not configured or failed - continue without it
        console.warn('Anonymous auth unavailable, using localStorage only:', authError)
      }
      
      // Clear any existing save (new run starts fresh)
      localStorage.removeItem('dungeon_portal_save')
      
      // Store new character name in localStorage
      localStorage.setItem('dungeon_portal_character', trimmedName)
      
      // Redirect to game (will trigger character class selection)
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Unexpected error during login:', error)
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-500 mb-2">Dungeon Portal</h1>
          <p className="text-slate-400">Choose how you&apos;d like to begin your adventure</p>
        </div>

        {/* Quick Start: Anonymous */}
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <Ghost size={28} className="text-amber-500" />
            <h2 className="text-xl font-bold">Quick Start</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Jump right in as a guest. Your progress will be saved to this device and the global leaderboard.
          </p>
          <button 
            onClick={handleAnonymousLogin}
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-600 p-3 rounded font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Ghost size={20} />
            {loading ? 'Starting...' : 'Continue as Guest'}
          </button>
        </div>

        {/* Named Character */}
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <UserCircle size={28} className="text-amber-500" />
            <h2 className="text-xl font-bold">Named Character</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Enter a character name for your run. You can use the same name across multiple adventures.
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Character Name</label>
              <input 
                type="text" 
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Enter your character name..."
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 p-3 rounded font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserCircle size={20} />
              {loading ? 'Starting...' : 'Start New Run'}
            </button>
          </form>
        </div>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
