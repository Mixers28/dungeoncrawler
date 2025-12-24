import { GameState } from './game-schema'
import { saveScoreToSupabase } from './supabase/leaderboard'

// Feature flag - set to false to disable Supabase leaderboard
const ENABLE_GLOBAL_LEADERBOARD = process.env.NEXT_PUBLIC_ENABLE_GLOBAL_LEADERBOARD !== 'false'

export interface LeaderboardEntry {
  id: string
  characterName: string
  characterClass: string
  deepestFloor: number
  goldCollected: number
  killCount: number
  status: 'win' | 'loss'
  completedAt: string
}

const LEADERBOARD_KEY = 'dungeon_portal_leaderboard'
const DEFAULT_LEADERBOARD_LIMIT = 10
const MAX_STORED_ENTRIES = 100

export function sanitizeString(input: string): string {
  // Remove HTML tags and limit length
  return input.replace(/<[^>]*>/g, '').trim().slice(0, 50)
}

function extractDeepestFloor(locationHistory: string[] | undefined): number {
  if (!locationHistory || locationHistory.length === 0) return 0
  
  const floors = locationHistory
    .map(l => {
      const match = l.match(/floor[_-]?(\d+)/i)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter(f => !isNaN(f) && f > 0)
  
  return floors.length > 0 ? Math.max(...floors) : 0
}

export function saveScore(gameState: GameState, status: 'win' | 'loss', userId?: string): void {
  // Save to localStorage (always, as fallback)
  saveScoreToLocalStorage(gameState, status)
  
  // Save to Supabase if enabled and userId provided
  if (ENABLE_GLOBAL_LEADERBOARD && userId) {
    saveScoreToSupabase(gameState, status, userId).catch(error => {
      console.error('Failed to save to Supabase, localStorage fallback active:', error)
    })
  }
}

function saveScoreToLocalStorage(gameState: GameState, status: 'win' | 'loss'): void {
  // Count kills from nearbyEntities that have status 'dead'
  const killCount = gameState.nearbyEntities?.filter(e => e.status === 'dead').length || 0
  
  const entry: LeaderboardEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    characterName: sanitizeString(gameState.character?.name || 'Unknown'),
    characterClass: sanitizeString(gameState.character?.class || 'Unknown'),
    deepestFloor: extractDeepestFloor(gameState.locationHistory),
    goldCollected: gameState.gold || 0,
    killCount,
    status,
    completedAt: new Date().toISOString()
  }

  const existing = getLeaderboard(MAX_STORED_ENTRIES)
  const updated = [...existing, entry].slice(-MAX_STORED_ENTRIES)
  
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save leaderboard (quota exceeded?):', error)
    // Try to save with reduced set if quota exceeded
    const reduced = updated.slice(-50)
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(reduced))
    } catch {
      // Silent fail - leaderboard is not critical
    }
  }
}

export function getLeaderboard(limit = DEFAULT_LEADERBOARD_LIMIT): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY)
    if (!data) return []
    
    const entries: LeaderboardEntry[] = JSON.parse(data)
    
    // Sort by: floor (desc), then gold (desc), then kills (desc)
    return entries
      .sort((a, b) => {
        if (b.deepestFloor !== a.deepestFloor) {
          return b.deepestFloor - a.deepestFloor
        }
        if (b.goldCollected !== a.goldCollected) {
          return b.goldCollected - a.goldCollected
        }
        return b.killCount - a.killCount
      })
      .slice(0, limit)
  } catch (error) {
    console.error('Failed to load leaderboard:', error)
    return []
  }
}

export function clearLeaderboard(): void {
  localStorage.removeItem(LEADERBOARD_KEY)
}

export function getCharacterStats(characterName: string): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY)
    if (!data) return []
    
    const entries: LeaderboardEntry[] = JSON.parse(data)
    return entries.filter(e => e.characterName === characterName)
  } catch (error) {
    console.error('Failed to load character stats:', error)
    return []
  }
}

// Re-export Supabase leaderboard functions for global access
export { getGlobalLeaderboard, getUserLeaderboard } from './supabase/leaderboard'
export { ENABLE_GLOBAL_LEADERBOARD }
