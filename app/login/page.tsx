'use client';

import { useState, useTransition } from 'react';
import { loginAction, signUpAction } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginAction(email, password);
      if (result?.error) setError(result.error);
    });
  }

  function handleSignUp() {
    setError(null);
    startTransition(async () => {
      const result = await signUpAction(email, password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4 p-8 bg-slate-900 rounded-lg border border-slate-800">
        <h1 className="text-2xl font-bold text-amber-500 mb-6">Dungeon Portal</h1>

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

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-amber-600 hover:bg-amber-700 p-2 rounded font-bold disabled:opacity-50"
          >
            {isPending ? '...' : 'Log In'}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={isPending}
            className="flex-1 bg-slate-700 hover:bg-slate-600 p-2 rounded font-bold disabled:opacity-50"
          >
            Sign Up
          </button>
        </div>
      </form>
    </div>
  );
}
