'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

export function HowToPlay() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-black text-slate-200">How to Play</h2>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {isOpen && (
          <div className="mt-4 p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-6 text-slate-300">
            <section>
              <h3 className="text-lg font-bold text-amber-500 mb-2">🎮 Getting Started</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Enter a character name and choose your class (Fighter, Rogue, Cleric, or Wizard)</li>
                <li>Each class has unique starting gear, bonuses, and abilities</li>
                <li>Your adventure begins at the entrance to the Sunken Citadel</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-bold text-amber-500 mb-2">⚔️ Combat System</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Combat uses D&D 5e rules with d20 rolls for attacks</li>
                <li>Type commands like &quot;attack skeleton&quot; or &quot;cast magic missile&quot;</li>
                <li>Your AC (Armor Class) and HP determine your survivability</li>
                <li>Defeated enemies may drop loot and always grant gold/XP</li>
                <li>Spellcasters have limited spell slots that restore on level up</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-bold text-amber-500 mb-2">🗺️ Exploration & Loot</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>The dungeon is organized by floors - each floor has a central hub with multiple passages to explore</li>
                <li>Navigate using commands like &quot;explore door&quot;, &quot;investigate passage&quot;, or &quot;descend stairs&quot;</li>
                <li>Explore all side rooms on a floor to unlock the stairs down to deeper levels</li>
                <li>Search rooms with &quot;search&quot; or &quot;look around&quot; to find hidden items</li>
                <li>Manage inventory with &quot;use potion&quot;, &quot;equip sword&quot;, or &quot;drop item&quot;</li>
                <li>Visit traders to buy potions, gear, and upgrades</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-bold text-amber-500 mb-2">💀 Death & Progression</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>When HP reaches 0, your run ends and is recorded on the leaderboard</li>
                <li>Gain XP from kills to level up and increase max HP</li>
                <li>Deeper floors contain stronger enemies and better loot</li>
                <li>Gold persists as your score for leaderboard ranking</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-bold text-amber-500 mb-2">💡 Tips & Strategies</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Always search rooms before leaving - you might find healing potions</li>
                <li>Keep healing potions for emergencies during tough fights</li>
                <li>Upgrade armor first for better survivability</li>
                <li>Rogues excel at stealth, Fighters at melee, Clerics at healing, Wizards at burst damage</li>
                <li>Explore thoroughly - some side rooms contain valuable loot or easier encounters</li>
                <li>Try creative actions! The AI DM rewards clever tactics with &quot;stunts&quot;</li>
              </ul>
            </section>

            <section className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 italic">
                Game is powered by AI narration and follows D&D 5e SRD rules. 
                Be creative with your commands - the dungeon master adapts to your choices.
              </p>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
