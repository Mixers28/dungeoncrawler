'use client'

import { Hero } from '../../components/Landing/Hero'
import { Leaderboard } from '../../components/Landing/Leaderboard'
import { HowToPlay } from '../../components/Landing/HowToPlay'
import { WhatsNew } from '../../components/Landing/WhatsNew'
import { Footer } from '../../components/Landing/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <main className="flex-1 max-w-6xl mx-auto w-full">
        <Hero />
        <Leaderboard />
        <HowToPlay />
        <WhatsNew />
      </main>
      
      <Footer />
    </div>
  )
}
