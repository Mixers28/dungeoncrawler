'use client'

import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    // Attempt Login
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      alert(error.message)
      setLoading(false)
    } else {
      router.push('/') // Redirect to game on success
      router.refresh()
    }
  }

  async function handleSignUp() {
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Check your email for the confirmation link!')
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 p-8 bg-slate-900 rounded-lg border border-slate-800">
        <h1 className="text-2xl font-bold text-amber-500 mb-6">Dungeon Portal Login</h1>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
            required 
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
            required 
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 bg-amber-600 hover:bg-amber-700 p-2 rounded font-bold"
          >
            {loading ? '...' : 'Log In'}
          </button>
          <button 
            type="button" 
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-slate-700 hover:bg-slate-600 p-2 rounded font-bold"
          >
            Sign Up
          </button>
        </div>
      </form>
    </div>
  )
}
