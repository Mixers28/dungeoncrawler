'use client'

import { useState } from 'react'
import { Newspaper, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface ChangelogEntry {
  date: string
  version: string
  sha: string
  changes: string[]
}

const REPO_URL = 'https://github.com/Mixers28/dungeoncrawler'

// Static changelog - can be replaced with git log parsing
const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2025-12-24',
    version: '0.1.0',
    sha: '081f1f4',
    changes: [
      'Removed Supabase authentication',
      'Implemented localStorage-based game saves',
      'Simplified login to character name only',
      'Added landing page with leaderboard',
    ]
  },
  {
    date: '2025-12-21',
    version: '0.0.9',
    sha: '88c453a',
    changes: [
      'Added potion use mechanics',
      'Normalized documentation references',
      'Sprint 1 completion',
    ]
  },
  {
    date: '2025-12-20',
    version: '0.0.8',
    sha: '0e80a45',
    changes: [
      'Refactored game logic into lib/game modules',
      'Improved code organization',
      'Enhanced maintainability',
    ]
  },
]

export function WhatsNew() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-black text-slate-200">What&apos;s New</h2>
            <span className="px-2 py-1 bg-amber-900/30 text-amber-400 text-xs font-bold rounded">
              v{CHANGELOG[0].version}
            </span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {isOpen && (
          <div className="mt-4 space-y-4">
            {CHANGELOG.map((entry, index) => (
              <div
                key={entry.sha}
                className={`p-4 bg-slate-900 border border-slate-800 rounded-lg ${
                  index === 0 ? 'border-amber-900/50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-200">v{entry.version}</span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 bg-green-900/30 text-green-400 text-xs font-bold rounded">
                          LATEST
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{entry.date}</span>
                      <span>•</span>
                      <a
                        href={`${REPO_URL}/commit/${entry.sha}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono hover:text-amber-500 transition-colors flex items-center gap-1"
                      >
                        {entry.sha}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
                
                <ul className="space-y-1 text-sm text-slate-300">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-1">→</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
