/**
 * Monster Image Service
 * 
 * Manages monster image generation, caching, and retrieval.
 * Uses a pre-generated cache in /public/monster-cache/ for common monsters
 * with fallback to placeholder images.
 */

export interface MonsterImageMetadata {
  monsterType: string;
  imageUrl: string;
  cachedAt: string;
  prompt?: string;
}

export interface MonsterCacheManifest {
  version: string;
  generatedAt: string;
  monsters: MonsterImageMetadata[];
}

/**
 * Normalize monster name to cache key format
 * Examples: "Giant Rat" -> "giant_rat", "Goblin Scout" -> "goblin_scout"
 */
export function normalizeMonsterType(monsterName: string): string {
  return monsterName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '_'); // Spaces to underscores
}

/**
 * Get the cached image URL for a monster type
 * Returns null if not in cache
 */
export function getCachedMonsterImageUrl(monsterType: string): string | null {
  const normalized = normalizeMonsterType(monsterType);
  const cachePath = `/monster-cache/${normalized}.png`;
  
  // Note: We can't check file existence in browser context
  // Pre-generation script ensures these files exist
  // Client-side validation happens via image onError handler
  return cachePath;
}

/**
 * Get the monster image URL with fallback
 * Primary: cached image
 * Fallback: placeholder silhouette
 */
export function getMonsterImageUrl(monsterType: string): string {
  const cached = getCachedMonsterImageUrl(monsterType);
  if (cached) {
    return cached;
  }
  
  // Fallback to generic placeholder
  return '/monster-cache/placeholder.png';
}

/**
 * Generate descriptive prompt for monster image generation
 * Used by pre-generation script
 */
export function getMonsterPrompt(monsterType: string): string {
  const normalized = normalizeMonsterType(monsterType);
  
  // Common prompt templates
  const basePrompt = `A ${monsterType} in a dark dungeon, fantasy art style, dramatic lighting, top-down perspective`;
  
  // Special cases for better prompt engineering
  const specialCases: Record<string, string> = {
    'giant_rat': 'A massive rat creature with glowing red eyes in a damp dungeon, fantasy art, dramatic shadows',
    'goblin': 'A cunning goblin warrior with crude weapons in a dark cave, fantasy art, menacing pose',
    'skeleton': 'An animated skeleton warrior with rusted armor in a crypt, fantasy art, eerie blue glow',
    'orc': 'A hulking orc warrior with battle scars and crude axe, fantasy art, aggressive stance',
    'zombie': 'A rotting zombie with tattered clothes shambling through dungeon, fantasy art, horror atmosphere',
    'wolf': 'A feral wolf with glowing eyes stalking through dark forest, fantasy art, predatory',
    'spider': 'A giant spider with dripping fangs in web-covered lair, fantasy art, menacing',
    'bandit': 'A ruthless bandit with mask and daggers in shadowy corridor, fantasy art, stealthy',
    'cultist': 'A robed cultist with ritual dagger and dark symbols, fantasy art, ominous',
    'ghost': 'A translucent ghost with ethereal glow in abandoned room, fantasy art, supernatural',
  };
  
  return specialCases[normalized] || basePrompt;
}

/**
 * Load the monster cache manifest
 * Returns null if not found or invalid
 */
export async function loadMonsterCacheManifest(): Promise<MonsterCacheManifest | null> {
  try {
    const response = await fetch('/monster-cache/manifest.json');
    if (!response.ok) {
      return null;
    }
    const manifest = await response.json() as MonsterCacheManifest;
    return manifest;
  } catch (error) {
    console.warn('Failed to load monster cache manifest:', error);
    return null;
  }
}

/**
 * Check if a monster type exists in the cache
 * Useful for conditional rendering
 */
export async function isMonsterCached(monsterType: string): Promise<boolean> {
  const manifest = await loadMonsterCacheManifest();
  if (!manifest) {
    return false;
  }
  
  const normalized = normalizeMonsterType(monsterType);
  return manifest.monsters.some(m => normalizeMonsterType(m.monsterType) === normalized);
}

/**
 * Get all available monster types from cache
 * Useful for debugging and development
 */
export async function getAvailableMonsters(): Promise<string[]> {
  const manifest = await loadMonsterCacheManifest();
  if (!manifest) {
    return [];
  }
  
  return manifest.monsters.map(m => m.monsterType);
}
