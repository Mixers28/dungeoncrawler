'use client'

import Link from 'next/link'

export default function SplashPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
      <div className="w-full max-w-lg space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-black text-amber-500">Dungeon Portal</h1>
        <p className="text-slate-400">
          Log in to continue your adventure or start a new run.
        </p>
        <div className="flex justify-end">
          <Link
            href="/login"
            className="bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold px-6 py-3 rounded transition-all"
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  )
}
