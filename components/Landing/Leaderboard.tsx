'use client'

import { useState } from 'react'
import { Trophy, Trash2 } from 'lucide-react'
import { getLeaderboard, clearLeaderboard, type LeaderboardEntry } from '../../lib/leaderboard'

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(getLeaderboard(10))
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  function handleClear() {
    clearLeaderboard()
    setEntries([])
    setShowClearConfirm(false)
  }

  return (
    <section id="leaderboard" className="px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            <h2 className="text-3xl font-black text-slate-200">Top Adventurers</h2>
          </div>
          
          {entries.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-sm text-slate-500 hover:text-red-500 flex items-center gap-2 transition-colors"
              aria-label="Clear leaderboard"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {showClearConfirm && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-900 rounded-lg">
            <p className="text-red-400 mb-3">Are you sure you want to clear the leaderboard? This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No completed runs yet.</p>
            <p className="text-sm mt-2">Be the first to conquer the dungeon!</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 text-slate-400 text-sm">
                  <tr>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Class</th>
                    <th className="px-4 py-3 text-right">Floor</th>
                    <th className="px-4 py-3 text-right">Gold</th>
                    <th className="px-4 py-3 text-right">Kills</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {entries.map((entry, index) => (
                    <tr 
                      key={entry.id}
                      className="border-t border-slate-800 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {index === 0 ? (
                          <span className="text-amber-500 font-bold text-lg">🥇</span>
                        ) : index === 1 ? (
                          <span className="text-slate-400 font-bold text-lg">🥈</span>
                        ) : index === 2 ? (
                          <span className="text-orange-600 font-bold text-lg">🥉</span>
                        ) : (
                          <span className="text-slate-500">#{index + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{entry.characterName}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 capitalize">
                        {entry.characterClass}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{entry.deepestFloor}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-500">
                        {entry.goldCollected}g
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{entry.killCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                            entry.status === 'win'
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}
                        >
                          {entry.status === 'win' ? 'VICTORY' : 'DEFEATED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
