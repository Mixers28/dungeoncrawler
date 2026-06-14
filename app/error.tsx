'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 gap-4 p-8">
      <h2 className="text-xl font-bold text-red-500">Something went wrong!</h2>
      <p className="text-slate-400 text-sm font-mono bg-slate-900 px-4 py-2 rounded max-w-lg text-center break-all">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        className="px-4 py-2 bg-amber-600 rounded font-bold hover:bg-amber-700"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
