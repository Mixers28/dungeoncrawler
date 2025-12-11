import fs from 'fs';
import path from 'path';

export type StoryExit = {
  verb: string[];
  targetSceneId: string;
  consumeItem?: string;
  log?: string;
};

export type StorySpawn = {
  name: string;
  hp: number;
  maxHp?: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
};

export type StoryScene = {
  id: string;
  group?: string;
  title?: string;
  location: string;
  narrationKey?: string;
  description?: string;
  entryConditions?: {
    minLevel?: number;
    requiresItem?: string;
    flagsAll?: string[];
    flagsAny?: string[];
  };
  onEnter?: {
    log?: string;
    spawn?: StorySpawn[];
  };
  exits?: StoryExit[];
  onComplete?: {
    flagsSet?: string[];
    reward?: { xp?: number; lootTable?: string; items?: string[] };
  };
};

let cachedScenes: Record<string, StoryScene> | null = null;
let cachedGroups: Record<string, StoryScene[]> | null = null;

function loadScenesFromDisk(): StoryScene[] {
  const storyDir = path.join(process.cwd(), 'story');
  const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.json'));
  const scenes: StoryScene[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(storyDir, file), 'utf8');
      const parsed = JSON.parse(raw);
      // Skip non-scene helper JSON (e.g., flavor packs)
      if (parsed.id && parsed.location) {
        scenes.push(parsed as StoryScene);
      }
    } catch (err) {
      console.error('Failed to parse story file', file, err);
    }
  }
  return scenes;
}

function ensureCache() {
  if (!cachedScenes || !cachedGroups) {
    const scenes = loadScenesFromDisk();
    cachedScenes = scenes.reduce<Record<string, StoryScene>>((acc, scene) => {
      acc[scene.id] = scene;
      return acc;
    }, {});
    cachedGroups = scenes.reduce<Record<string, StoryScene[]>>((acc, scene) => {
      const key = scene.group || scene.id;
      acc[key] = acc[key] || [];
      acc[key].push(scene);
      return acc;
    }, {});
  }
}

export function getSceneById(id: string | undefined): StoryScene | null {
  ensureCache();
  if (!id || !cachedScenes) return null;
  return cachedScenes[id] || null;
}

export function pickSceneVariant(group: string, seed: number): StoryScene | null {
  ensureCache();
  if (!cachedGroups) return null;
  const list = cachedGroups[group];
  if (!list || list.length === 0) return null;
  const idx = Math.abs(seed) % list.length;
  return list[idx];
}

export function listScenes(): StoryScene[] {
  ensureCache();
  return Object.values(cachedScenes || {});
}
