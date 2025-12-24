import { createClient } from '@/utils/supabase/client'
import type { GameState } from '../game-schema'

export interface SupabaseLeaderboardEntry {
  id: string
  user_id: string
  character_name: string
  character_class: string
  deepest_floor: number
  gold_collected: number
  kill_count: number
  status: 'win' | 'loss'
  completed_at: string
  created_at: string
}

function sanitizeString(input: string): string {
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

/**
 * Save a game score to Supabase leaderboard
 */
export async function saveScoreToSupabase(
  gameState: GameState,
  status: 'win' | 'loss',
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const killCount = gameState.nearbyEntities?.filter(e => e.status === 'dead').length || 0
    
    const entry = {
      user_id: userId,
      character_name: sanitizeString(gameState.character?.name || 'Unknown'),
      character_class: sanitizeString(gameState.character?.class || 'Unknown'),
      deepest_floor: extractDeepestFloor(gameState.locationHistory),
      gold_collected: gameState.gold || 0,
      kill_count: killCount,
      status,
      completed_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('leaderboard_entries')
      .insert(entry)

    if (error) {
      console.error('Failed to save leaderboard entry to Supabase:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving to Supabase:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get global leaderboard sorted by floor, gold, kills
 */
export async function getGlobalLeaderboard(
  limit = 10
): Promise<{ data: SupabaseLeaderboardEntry[]; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .order('deepest_floor', { ascending: false })
      .order('gold_collected', { ascending: false })
      .order('kill_count', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to fetch global leaderboard:', error)
      return { data: [], error: error.message }
    }

    return { data: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching leaderboard:', error)
    return { 
      data: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get leaderboard entries for a specific user
 */
export async function getUserLeaderboard(
  userId: string,
  limit = 20
): Promise<{ data: SupabaseLeaderboardEntry[]; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to fetch user leaderboard:', error)
      return { data: [], error: error.message }
    }

    return { data: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching user leaderboard:', error)
    return { 
      data: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get user's rank in global leaderboard based on best run
 */
export async function getUserRank(
  userId: string
): Promise<{ rank: number | null; totalPlayers: number; error?: string }> {
  try {
    const supabase = createClient()
    
    // Get user's best score
    const { data: userBest, error: userError } = await supabase
      .from('leaderboard_entries')
      .select('deepest_floor, gold_collected, kill_count')
      .eq('user_id', userId)
      .order('deepest_floor', { ascending: false })
      .order('gold_collected', { ascending: false })
      .order('kill_count', { ascending: false })
      .limit(1)
      .single()

    if (userError || !userBest) {
      return { rank: null, totalPlayers: 0, error: 'No runs found' }
    }

    // Count how many players have better scores
    const { count, error: countError } = await supabase
      .from('leaderboard_entries')
      .select('user_id', { count: 'exact', head: true })
      .or(`deepest_floor.gt.${userBest.deepest_floor},and(deepest_floor.eq.${userBest.deepest_floor},gold_collected.gt.${userBest.gold_collected}),and(deepest_floor.eq.${userBest.deepest_floor},gold_collected.eq.${userBest.gold_collected},kill_count.gt.${userBest.kill_count})`)

    if (countError) {
      console.error('Failed to calculate rank:', countError)
      return { rank: null, totalPlayers: 0, error: countError.message }
    }

    // Get total unique players
    const { count: totalCount } = await supabase
      .from('leaderboard_entries')
      .select('user_id', { count: 'exact', head: true })

    const rank = (count || 0) + 1
    const totalPlayers = totalCount || 0

    return { rank, totalPlayers }
  } catch (error) {
    console.error('Unexpected error calculating rank:', error)
    return { 
      rank: null, 
      totalPlayers: 0,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
