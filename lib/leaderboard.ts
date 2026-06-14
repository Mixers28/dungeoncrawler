import { GameState } from './game-schema'

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

export function saveScore(gameState: GameState, status: 'win' | 'loss'): void {
  const killCount = gameState.totalKills ?? 0
  const entry: LeaderboardEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    characterName: sanitizeString(gameState.character?.name || 'Unknown'),
    characterClass: sanitizeString(gameState.character?.class || 'Unknown'),
    deepestFloor: extractDeepestFloor(gameState.locationHistory),
    goldCollected: gameState.gold || 0,
    killCount,
    status,
    completedAt: new Date().toISOString(),
  }

  const existing = getLeaderboard(MAX_STORED_ENTRIES)
  const updated = [...existing, entry].slice(-MAX_STORED_ENTRIES)
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated))
  } catch {
    // Silent fail — leaderboard is not critical
  }
}

export function getLeaderboard(limit = DEFAULT_LEADERBOARD_LIMIT): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY)
    if (!data) return []
    const entries: LeaderboardEntry[] = JSON.parse(data)
    return entries
      .sort((a, b) => {
        if (b.deepestFloor !== a.deepestFloor) return b.deepestFloor - a.deepestFloor
        if (b.goldCollected !== a.goldCollected) return b.goldCollected - a.goldCollected
        return b.killCount - a.killCount
      })
      .slice(0, limit)
  } catch {
    return []
  }
}

export function clearLeaderboard(): void {
  localStorage.removeItem(LEADERBOARD_KEY)
}
