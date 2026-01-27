# Monster Image Infrastructure

**Status**: Phase 2 Complete ✅  
**Date**: 2025-12-24

## Overview

Added infrastructure for visual monster representation in the dungeon crawler. Monsters now have associated images with a caching system for performance and consistency.

## Implementation

### 1. Monster Image Service (`lib/game/monster-images.ts`)

**Functions:**
- `normalizeMonsterType(name)` - Convert monster names to cache keys (e.g., "Giant Rat" → "giant_rat")
- `getMonsterImageUrl(type)` - Get cached image URL with fallback to placeholder
- `getCachedMonsterImageUrl(type)` - Direct cache lookup without fallback
- `getMonsterPrompt(type)` - Generate descriptive prompts for image generation (33 pre-defined templates)
- `loadMonsterCacheManifest()` - Async load of manifest.json
- `isMonsterCached(type)` - Check if monster has cached image
- `getAvailableMonsters()` - List all cached monsters

**Cache System:**
- Images stored in `public/monster-cache/{normalized_name}.png`
- Manifest at `public/monster-cache/manifest.json` tracks all cached monsters
- Client-side validation via image `onError` handlers
- Placeholder fallback for missing images

### 2. Schema Updates (`lib/game-schema.ts`)

**Entity Schema Extensions:**
```typescript
entitySchema = z.object({
  // ... existing fields ...
  imageUrl: z.string().optional(),     // Path to cached monster image
  position: z.object({                  // Grid position for battlefield view
    x: z.number(),
    y: z.number(),
  }).optional(),
})
```

**GameState Schema Extensions:**
```typescript
gameStateSchema = z.object({
  // ... existing fields ...
  monsterRegistry: z.record(z.object({
    imageUrl: z.string(),              // Cached image path
    lastSeenFloor: z.number(),         // Tracking for progression
    encounterCount: z.number(),        // Combat analytics
  })).default({}),
})
```

### 3. Scene Initialization (`lib/game/state.ts`)

**Monster Spawning:**
- Automatically assigns `imageUrl` to entities on spawn
- Registers monsters in `monsterRegistry` for tracking
- Increments `encounterCount` on each encounter
- Updates `lastSeenFloor` to current dungeon depth

**Code:**
```typescript
if (scene.onEnter?.spawn) {
  const { getMonsterImageUrl } = await import('./monster-images');
  
  nextState.nearbyEntities = scene.onEnter.spawn.map(sp => ({
    // ... existing fields ...
    imageUrl: getMonsterImageUrl(sp.name),
    position: undefined, // Assigned by battlefield view
  }));
  
  // Register in monsterRegistry
  for (const sp of scene.onEnter.spawn) {
    const normalized = normalizeMonsterType(sp.name);
    nextState.monsterRegistry[normalized] = {
      imageUrl: getMonsterImageUrl(sp.name),
      lastSeenFloor: nextState.currentFloor,
      encounterCount: (existing?.encounterCount || 0) + 1,
    };
  }
}
```

### 4. Pre-generation Script (`scripts/pre-generate-monsters.js`)

**Features:**
- 33 common monsters with descriptive prompts
- Extracted 8 monsters from existing story files
- Added 25 D&D common monsters for future expansion
- Generates `manifest.json` with metadata

**Current Monsters (In Game):**
1. Giant Rat
2. Skeleton
3. Skeleton Archer
4. Skeleton Spearman
5. Zombie
6. Armoured Zombie
7. Cultist Acolyte
8. Fallen Knight

**Future Expansion (25 additional):**
Goblin, Orc, Wolf, Spider, Bandit, Cultist, Ghost, Shadow, Wraith, Ghoul, Kobold, Stirge, Animated Armor, Flying Sword, Mimic, and variants.

**Usage:**
```bash
node scripts/pre-generate-monsters.js
```

## Current State

**Completed:**
✅ Monster image service with caching logic  
✅ Entity schema extensions (imageUrl, position)  
✅ GameState monsterRegistry tracking  
✅ Automatic monster registration on spawn  
✅ Pre-generation script with 33 monsters  
✅ Manifest generation with prompts  
✅ Lint validation passed (0 errors)

**Pending:**
⚠️ Actual image generation (requires API integration)  
⚠️ Placeholder image creation (512x512 gray silhouette)  
⚠️ Battlefield visual components (Phase 3)  
⚠️ Position assignment logic for grid layout

## Testing

**Validation:**
```bash
npm run lint  # ✅ 0 errors, 0 warnings
node scripts/pre-generate-monsters.js  # ✅ Manifest created
```

**Expected Behavior:**
1. Monsters spawn with `imageUrl` field populated
2. `monsterRegistry` tracks all encountered monsters
3. Image URLs resolve to `/monster-cache/{name}.png`
4. Missing images gracefully fallback to placeholder
5. Position field ready for battlefield grid assignment

## Next Steps

**Phase 3: Battlefield Visual Components**
1. Create `components/BattlefieldView.tsx` - Grid layout container
2. Create `components/MonsterCard.tsx` - Individual monster display with HP bars
3. Create `components/PlayerAvatar.tsx` - Player character representation
4. Create `components/ActionBar.tsx` - Quick action buttons
5. Create `components/NarrationLog.tsx` - Compact combat messages

**Image Generation (Optional):**
- Integrate with DALL-E, Midjourney, or Stable Diffusion API
- Generate PNG files using pre-defined prompts
- Save to `public/monster-cache/{normalized_name}.png`
- Update manifest with file sizes and generation metadata

## Technical Notes

**Performance:**
- Dynamic import of monster-images service prevents circular dependencies
- Manifest cached in browser after first load
- Image URLs resolve immediately (no async lookup)
- Registry tracks encounters without querying manifest repeatedly

**Security:**
- Normalized names prevent path traversal attacks
- Special characters stripped from cache keys
- Client-side validation via image error handlers
- No server-side file system access

**Compatibility:**
- Works with existing combat system
- No breaking changes to game state schema (fields optional)
- Backward compatible with saves lacking imageUrl/position
- Graceful degradation if monster-cache missing
