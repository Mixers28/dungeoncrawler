'use client'

import { BUILD_SHA, BUILD_TIME } from '../../lib/build-info'
import { Github } from 'lucide-react'

const REPO_URL = 'https://github.com/Mixers28/dungeoncrawler'

export function Footer() {
  const buildDate = new Date(BUILD_TIME).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return (
    <footer className="border-t border-slate-800 mt-16 py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono">
            v0.1.0 <span className="text-slate-600">•</span> build <span className="text-amber-500">{BUILD_SHA}</span>
          </span>
          <span className="text-slate-600">•</span>
          <span>{buildDate}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-amber-500 transition-colors"
            aria-label="View source code on GitHub"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <span className="text-slate-600">© 2025 Dungeon Portal</span>
        </div>
      </div>
    </footer>
  )
}
