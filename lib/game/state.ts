import fs from 'fs/promises';
import path from 'path';
import { gameStateSchema, type GameState, type LogEntry, type NarrationMode } from '../game-schema';
import { getSceneById, pickSceneVariant } from '../story';
import { getClassReference } from '../5e/classes';
import { armorByName, starterCharacters, weaponsByName } from '../5e/reference';
import { armorById, normalizeWeaponName, resolveArmorId, resolveWeaponId, weaponsById } from '../items';
import { getNextLevelDef } from '../progression';
import { ARCHETYPES, ArchetypeKey } from '../../app/characters';

export type { GameState, LogEntry, NarrationMode };
export { gameStateSchema };

const DEFAULT_ABILITY_SCORES: Record<string, number> = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

function isShieldItem(name: string): boolean {
  const key = name.toLowerCase();
  return armorByName[key]?.category?.toLowerCase() === 'shield';
}

function mapLegacyNarrationMode(mode: string | undefined): NarrationMode | undefined {
  if (!mode) return undefined;
  switch (mode) {
    case 'GENERAL_INTERACTION':
      return 'GENERAL';
    case 'COMBAT_FOCUS':
      return 'COMBAT_HIT';
    case 'SEARCH':
      return 'SEARCH_EMPTY';
    case 'LOOT':
      return 'LOOT_GAIN';
    case 'INSPECTION':
      return 'INVESTIGATE';
    case 'INVESTIGATE':
    case 'ROOM_INTRO':
    case 'SHEET':
      return mode;
    default:
      return undefined;
  }
}

const VALID_NARRATION_MODES = new Set<string>([
  'ROOM_INTRO',
  'COMBAT_HIT',
  'COMBAT_MISS',
  'COMBAT_KILL',
  'SEARCH_FOUND',
  'SEARCH_EMPTY',
  'LOOT_GAIN',
  'INVESTIGATE',
  'GENERAL',
  'SHEET',
]);

function normalizeLegacyNarrationModes(rawState: unknown): unknown {
  if (!rawState || typeof rawState !== 'object') return rawState;
  const state = rawState as Record<string, unknown>;
  if (!Array.isArray(state.log)) return rawState;
  const normalizedLog = (state.log as Array<Record<string, unknown>>).map(entry => {
    if (!entry || typeof entry !== 'object') return entry;
    const rawMode = entry.mode;
    const mappedMode = mapLegacyNarrationMode(rawMode as string | undefined);
    const finalMode =
      mappedMode ??
      (typeof rawMode === 'string' && VALID_NARRATION_MODES.has(rawMode)
        ? rawMode
        : 'GENERAL');
    return { ...entry, mode: finalMode };
  });
  return { ...state, log: normalizedLog };
}

function buildInventoryFromEquipment(equipment: string[]): GameState["inventory"] {
  let equippedWeapon = false;
  let equippedArmor = false;
  let equippedShield = false;

  return equipment.map((rawName, idx) => {
    const normalizedKey = normalizeWeaponName(rawName);
    const weaponRef = weaponsByName[normalizedKey];
    const armorRef = armorByName[normalizedKey];
    const isWeapon = !!weaponRef;
    const isArmor = !!armorRef;
    const isShield = isArmor && armorRef?.category?.toLowerCase() === 'shield';
    const type: 'weapon' | 'armor' | 'misc' = isWeapon ? 'weapon' : isArmor ? 'armor' : 'misc';
    const displayName = weaponRef?.name || armorRef?.name || rawName.replace(/_/g, ' ');
    let equipped = false;
    if (isWeapon && !equippedWeapon) {
      equipped = true;
      equippedWeapon = true;
    } else if (isShield && !equippedShield) {
      equipped = true;
      equippedShield = true;
    } else if (isArmor && !isShield && !equippedArmor) {
      equipped = true;
      equippedArmor = true;
    }
    return {
      id: `eq-${idx}-${Date.now().toString(36)}`,
      name: displayName,
      type,
      quantity: 1,
      equipped,
    };
  });
}

function computeArmorClassFromEquipment(equipment: string[], abilities: Record<string, number>): number {
  const dexMod = Math.floor(((abilities?.dex || 10) - 10) / 2);
  let bestArmor = 10 + dexMod;
  let shieldBonus = 0;

  equipment.forEach(raw => {
    const key = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const armor = armorByName[key];
    if (!armor) return;
    if (armor.category.toLowerCase() === 'shield') {
      shieldBonus = Math.max(shieldBonus, armor.baseAC);
      return;
    }
    let dexCap = dexMod;
    if (typeof armor.maxDex === 'number') dexCap = Math.min(dexMod, armor.maxDex);
    else if (armor.maxDex === 'n/a') dexCap = 0;
    bestArmor = Math.max(bestArmor, armor.baseAC + dexCap);
  });

  return bestArmor + shieldBonus;
}

export function computeArmorClassFromInventory(
  inventory: GameState["inventory"],
  abilities: Record<string, number>
): number {
  const equippedArmor = inventory.filter(item => item.type === 'armor' && item.equipped).map(item => item.name);
  if (equippedArmor.length === 0) {
    return computeArmorClassFromEquipment([], abilities);
  }
  return computeArmorClassFromEquipment(equippedArmor, abilities);
}

function normalizeEquippedItems(state: GameState): void {
  const weaponItems = state.inventory.filter(item => item.type === 'weapon');
  const armorItems = state.inventory.filter(item => item.type === 'armor');

  let equippedWeaponName = weaponItems.find(item => item.equipped)?.name;
  if (!equippedWeaponName && state.equippedWeaponId) {
    equippedWeaponName = weaponsById[state.equippedWeaponId]?.name;
  }
  if (!equippedWeaponName && weaponItems.length > 0) {
    equippedWeaponName = weaponItems[0].name;
  }

  let equippedArmorName = armorItems.find(item => item.equipped && !isShieldItem(item.name))?.name;
  if (!equippedArmorName && state.equippedArmorId) {
    equippedArmorName = armorById[state.equippedArmorId]?.name;
  }
  if (!equippedArmorName) {
    const firstArmor = armorItems.find(item => !isShieldItem(item.name));
    if (firstArmor) equippedArmorName = firstArmor.name;
  }

  let equippedShieldName = armorItems.find(item => item.equipped && isShieldItem(item.name))?.name;
  if (!equippedShieldName) {
    const firstShield = armorItems.find(item => isShieldItem(item.name));
    if (firstShield) equippedShieldName = firstShield.name;
  }

  state.inventory = state.inventory.map(item => {
    if (item.type === 'weapon') {
      return { ...item, equipped: item.name === equippedWeaponName };
    }
    if (item.type === 'armor') {
      const isShield = isShieldItem(item.name);
      if (isShield) return { ...item, equipped: item.name === equippedShieldName };
      return { ...item, equipped: item.name === equippedArmorName };
    }
    return { ...item, equipped: false };
  });

  if (equippedWeaponName) state.equippedWeaponId = resolveWeaponId(equippedWeaponName);
  if (equippedArmorName) state.equippedArmorId = resolveArmorId(equippedArmorName);
}

export function applySceneEntry(
  sceneId: string,
  baseState: GameState,
  summaryParts: string[],
  opts?: { recordHistory?: boolean }
): { state: GameState; roomDesc: string } {
  const scene = getSceneById(sceneId);
  const nextState = { ...baseState };
  const recordHistory = opts?.recordHistory ?? true;
  let roomDesc = baseState.roomRegistry?.[scene?.location || baseState.location] || baseState.location;

  if (scene) {
    nextState.storySceneId = scene.id;
    nextState.location = scene.location;
    if (scene.description) {
      roomDesc = scene.description;
      nextState.roomRegistry = { ...(nextState.roomRegistry || {}), [scene.location]: scene.description };
    }
    if (scene.onEnter?.log) {
      summaryParts.push(scene.onEnter.log);
    }
    if (scene.onEnter?.spawn) {
      nextState.nearbyEntities = scene.onEnter.spawn.map(sp => ({
        name: sp.name,
        status: 'alive',
        description: sp.name,
        hp: sp.hp,
        maxHp: sp.maxHp || sp.hp,
        ac: sp.ac,
        attackBonus: sp.attackBonus,
        damageDice: sp.damageDice,
        effects: [],
      }));
    } else {
      nextState.nearbyEntities = [];
    }
  }

  if (recordHistory) {
    const trail = nextState.locationHistory || [];
    nextState.locationHistory = [...trail, nextState.location].slice(-10);
  }

  return { state: nextState, roomDesc };
}

const SCENE_CACHE_MAX_BYTES = 200 * 1024 * 1024;
const SCENE_CACHE_MAX_FILES = 250;
const SCENE_FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureCacheDir() {
  const cacheDir = path.join(process.cwd(), 'public', 'scene-cache');
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (err) {
    console.error("Failed to ensure cache dir", err);
  }
  return cacheDir;
}

async function pruneSceneCache(cacheDir: string) {
  try {
    const entries = await fs.readdir(cacheDir, { withFileTypes: true });
    const files = entries.filter(entry => entry.isFile());
    if (files.length === 0) return;

    const stats = await Promise.all(files.map(async entry => {
      const fullPath = path.join(cacheDir, entry.name);
      const info = await fs.stat(fullPath);
      return { path: fullPath, mtimeMs: info.mtimeMs, size: info.size };
    }));

    stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    let totalBytes = stats.reduce((sum, file) => sum + file.size, 0);

    while (stats.length > SCENE_CACHE_MAX_FILES || totalBytes > SCENE_CACHE_MAX_BYTES) {
      const oldest = stats.shift();
      if (!oldest) break;
      try {
        await fs.unlink(oldest.path);
        totalBytes -= oldest.size;
      } catch (err) {
        console.error("Failed to prune cache file", oldest.path, err);
        break;
      }
    }
  } catch (err) {
    console.error("Failed to prune scene cache", err);
  }
}

async function cacheSceneImage(remoteUrl: string, fileName: string): Promise<string | null> {
  try {
    const cacheDir = await ensureCacheDir();
    const filePath = path.join(cacheDir, fileName);
    try {
      await fs.access(filePath);
      return `/scene-cache/${fileName}`;
    } catch {
      // proceed to fetch
    }
    const res = await fetchWithTimeout(remoteUrl, SCENE_FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    await pruneSceneCache(cacheDir);
    return `/scene-cache/${fileName}`;
  } catch (err) {
    console.error("Image cache fetch failed, using remote URL", err);
    return null;
  }
}

export async function resolveSceneImage(state: GameState): Promise<{ url: string; registry: Record<string, string> }> {
  const VARIANT_POOL = 3;
  const activeThreat = state.nearbyEntities.find(e => e.status !== 'dead' && e.status !== 'object');
  const sceneKey = activeThreat ? `${state.location}|${activeThreat.name}` : state.location;
  if (state.sceneRegistry && state.sceneRegistry[sceneKey]) {
    return { url: state.sceneRegistry[sceneKey], registry: state.sceneRegistry };
  }
  let visualPrompt = state.location;
  if (activeThreat) visualPrompt = `A terrifying ${activeThreat.name} inside ${state.location}`;
  const subjectHash = visualPrompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variantIndex = Math.abs((state.worldSeed || 0) % VARIANT_POOL);
  const stableSeed = subjectHash + variantIndex * 9973;
  const encodedPrompt = encodeURIComponent(visualPrompt + " fantasy oil painting style dark gritty 8k");
  const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=300&nologo=true&seed=${stableSeed}`;
  const fileName = `${sceneKey.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${variantIndex}.jpg`;
  const cachedPath = await cacheSceneImage(remoteUrl, fileName);
  const finalUrl = cachedPath || remoteUrl;
  return { url: finalUrl, registry: { ...state.sceneRegistry, [sceneKey]: finalUrl } };
}

export async function resolveRoomDescription(state: GameState): Promise<{ desc: string, registry: Record<string, string> }> {
  if (state.roomRegistry && state.roomRegistry[state.location]) {
    return { desc: state.roomRegistry[state.location], registry: state.roomRegistry };
  }
  const aliveThreats = state.nearbyEntities.filter(e => e.status === 'alive').map(e => e.name);
  const desc = aliveThreats.length > 0
    ? `${state.location} with ${aliveThreats.join(', ')} nearby.`
    : `${state.location} is quiet.`;
  const newRegistry = { ...state.roomRegistry, [state.location]: desc };
  return { desc, registry: newRegistry };
}

export async function hydrateState(rawState: unknown): Promise<GameState> {
  const normalizedRawState = normalizeLegacyNarrationModes(rawState);
  const parsed = gameStateSchema.safeParse(normalizedRawState);
  if (!parsed.success) {
    throw new Error("Saved game is incompatible with the current version.");
  }
  const state = parsed.data;

  if (!Number.isFinite(state.worldSeed) || state.worldSeed <= 0) {
    state.worldSeed = Math.floor(Math.random() * 999999);
  }

  if (!state.skills || state.skills.length === 0) {
    const classKey = (state.character?.class || 'fighter').toLowerCase();
    state.skills = getClassReference(classKey).skills;
  }

  state.knownSpells = state.knownSpells || [];
  state.preparedSpells = state.preparedSpells || [];
  state.spellSlots = state.spellSlots || {};
  state.spellcastingAbility = state.spellcastingAbility || 'int';
  state.spellAttackBonus = state.spellAttackBonus || 0;
  state.spellSaveDc = state.spellSaveDc || 0;
  state.activeEffects = state.activeEffects || [];
  state.storySceneId = state.storySceneId || 'iron_gate_v1';
  state.storyFlags = state.storyFlags || [];
  state.turnCounter = state.turnCounter || 0;
  state.gold = Math.max(0, state.gold || 0);
  if (!state.abilityScores || Object.keys(state.abilityScores).length === 0) {
    const classKey = (state.character?.class || 'fighter').toLowerCase();
    const starter = starterCharacters.find(c => c.class.toLowerCase() === classKey);
    state.abilityScores = { ...DEFAULT_ABILITY_SCORES, ...(starter?.abilities || {}) };
  }
  state.equippedWeaponId = state.equippedWeaponId || resolveWeaponId(state.inventory.find(i => i.type === 'weapon')?.name);
  state.equippedArmorId = state.equippedArmorId || resolveArmorId(state.inventory.find(i => i.type === 'armor')?.name);
  normalizeEquippedItems(state);
  if (state.inventory.length > 0) {
    const computedAc = computeArmorClassFromInventory(state.inventory, state.abilityScores);
    state.ac = Math.max(state.ac, computedAc);
  }
  if (!Number.isFinite(state.xpToNext) || state.xpToNext <= 0) {
    const next = getNextLevelDef(state.level);
    state.xpToNext = next?.xpRequired ?? 300;
  }

  if ((!state.log || state.log.length === 0) && state.narrativeHistory && state.narrativeHistory.length > 0) {
    const migrated = state.narrativeHistory.map((entry, idx) => ({
      id: `log-migrated-${idx}-${Date.now().toString(36)}`,
      mode: "GENERAL" as const,
      summary: entry,
      flavor: undefined,
      createdAt: new Date().toISOString(),
    }));
    state.log = migrated.slice(-10);
  } else {
    state.log = state.log || [];
  }

  const { url, registry: sceneRegistry } = await resolveSceneImage(state);
  state.currentImage = url;
  state.sceneRegistry = sceneRegistry;

  const { registry: roomRegistry } = await resolveRoomDescription(state);
  state.roomRegistry = roomRegistry;

  return state;
}

export async function buildNewGameState(archetypeKey?: ArchetypeKey): Promise<GameState> {
  const archetype = archetypeKey && ARCHETYPES[archetypeKey] ? ARCHETYPES[archetypeKey] : ARCHETYPES.fighter;
  const classRef = getClassReference(archetypeKey || 'fighter');

  const startingWeapon = archetype.startingWeapon || 'Rusty Dagger';
  const startingArmor = archetype.startingArmor;
  const baseAc = 10 + (archetype.acBonus || 0);
  const baseHp = 20 + (archetype.hpBonus || 0);
  let initialHp = baseHp;
  let initialAc = baseAc;
  let skills = classRef.skills;
  let inventory: GameState["inventory"] = [
    { id: '1', name: startingWeapon, type: 'weapon', quantity: 1, equipped: true },
    ...(startingArmor
      ? [{ id: 'armor-1', name: startingArmor, type: 'armor' as const, quantity: 1, equipped: true }]
      : []),
  ];
  let knownSpells: string[] = [];
  let preparedSpells: string[] = [];
  let spellSlots: Record<string, { max: number; current: number }> = {};
  let spellcastingAbility = 'int';
  let spellAttackBonus = 0;
  let spellSaveDc = 0;
  let abilityScores = { ...DEFAULT_ABILITY_SCORES };

  const starter = starterCharacters.find(c => c.class.toLowerCase() === (archetypeKey || 'fighter')) || starterCharacters[0];
  if (starter) {
    initialHp = starter.max_hp;
    initialAc = computeArmorClassFromEquipment(starter.equipment, starter.abilities || {});
    abilityScores = { ...abilityScores, ...(starter.abilities || {}) };
    skills = starter.skills;
    inventory = buildInventoryFromEquipment(starter.equipment);
    inventory = [
      ...inventory,
      { id: `bandage-${Date.now().toString(36)}`, name: 'Bandage', type: 'misc', quantity: 2, equipped: false },
    ];

    if (starter.spells) {
      const cantrips = starter.spells.cantrips_known || [];
      const book = (starter.spells.spellbook && starter.spells.spellbook.length > 0)
        ? starter.spells.spellbook
        : (starter.spells.spell_list || []);
      const domain = starter.spells.domain_spells || [];
      knownSpells = [...cantrips, ...book, ...domain];
      preparedSpells = starter.spells.prepared || [];
    }
    if (starter.casting) {
      spellSlots = Object.fromEntries(
        Object.entries(starter.casting.slots || {}).map(([lvl, data]) => [lvl, { max: data.max, current: data.current }])
      );
      spellcastingAbility = starter.casting.spellcasting_ability || spellcastingAbility;
      spellAttackBonus = starter.casting.spell_attack_bonus || 0;
      spellSaveDc = starter.casting.spell_save_dc || 0;
    }
  }

  const worldSeed = Math.floor(Math.random() * 999999);
  const gateScene = pickSceneVariant('act1_gate', worldSeed) || getSceneById('iron_gate_v1');
  const nextLevel = getNextLevelDef(1);

  const baseState: GameState = {
    hp: initialHp, maxHp: initialHp, ac: initialAc, tempAcBonus: 0, gold: 0,
    level: 1, xp: 0, xpToNext: nextLevel?.xpRequired ?? 300,
    character: {
      name: 'Adventurer',
      class: archetype.label,
      background: archetype.background,
      acBonus: archetype.acBonus,
      hpBonus: archetype.hpBonus,
      startingWeapon,
      startingArmor: startingArmor || undefined,
    },
    location: gateScene?.location || "The Iron Gate",
    inventory,
    equippedWeaponId: resolveWeaponId(inventory.find(i => i.type === 'weapon')?.name),
    equippedArmorId: resolveArmorId(inventory.find(i => i.type === 'armor')?.name),
    skills,
    knownSpells,
    preparedSpells,
    spellSlots,
    spellcastingAbility,
    spellAttackBonus,
    spellSaveDc,
    abilityScores,
    quests: [{ id: '1', title: 'The Awakening', status: 'active', description: 'Find the Iron Key.' }],
    nearbyEntities: [],
    lastActionSummary: "The gates are locked. A monster guards the path.",
    worldSeed,
    narrativeHistory: [],
    log: [],
    sceneRegistry: {}, roomRegistry: {}, storyAct: 0, currentImage: "",
    locationHistory: [],
    inventoryChangeLog: [],
    lastRolls: {
      playerAttack: 0,
      playerDamage: 0,
      monsterAttack: 0,
      monsterDamage: 0,
      playerAttackIsSave: false,
      playerAttackDc: 0,
    },
    isCombatActive: false,
    storySceneId: gateScene?.id || 'iron_gate_v1',
    storyFlags: [],
    turnCounter: 0,
    activeEffects: [],
  };

  normalizeEquippedItems(baseState);

  const entrySummary: string[] = [];
  const { state: seededState } = applySceneEntry(baseState.storySceneId, baseState, entrySummary);
  seededState.lastActionSummary = entrySummary.join(' ').trim() || baseState.lastActionSummary;

  const { url, registry } = await resolveSceneImage(seededState);
  seededState.currentImage = url;
  seededState.sceneRegistry = registry;

  return seededState;
}
