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
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 gap-4">
      <h2 className="text-xl font-bold text-red-500">Something went wrong!</h2>
      <p className="text-slate-400">Your save file might be corrupted due to an update.</p>
      <button
        className="px-4 py-2 bg-amber-600 rounded font-bold hover:bg-amber-700"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  );
}
