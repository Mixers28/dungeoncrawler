'use server';

import fs from 'fs/promises';
import path from 'path';
import { createClient } from '../utils/supabase/server';
import { MONSTER_MANUAL, WEAPON_TABLE, STORY_ACTS } from '../lib/rules';
import { ARCHETYPES } from './characters';
import { getClassReference } from '../lib/5e/classes';
import { armorByName, starterCharacters, weaponsByName, wizardSpellsByName, clericSpellsByName } from '../lib/5e/reference';
import { parseActionIntentWithKnown, ParsedIntent } from '../lib/5e/intents';
import { getSceneById, pickSceneVariant } from '../lib/story';
import { rollLoot } from '../lib/loot';
import { gameStateSchema, type GameState, type LogEntry, type NarrationMode } from '../lib/game-schema';
import { generateCannedFlavor, type NarrationContext } from '../lib/narrationEngine';
import { classifyStunt, DIFFICULTY_TO_DC, type ClassifiedStunt, type StuntTemplate } from '../lib/stunts';


// --- HELPERS ---
function rollDice(notation: string): number {
  // Supports expressions like "1d6+2" or "1d4+1d6"
  const tokens = notation.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  if (tokens.length === 0) throw new Error(`Invalid dice expression: "${notation}"`);

  let total = 0;

  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[-+]/, '');

    if (body.includes('d')) {
      const [countStr, facesStr] = body.split('d');
      const count = countStr ? Number(countStr) : 1;
      const faces = Number(facesStr);
      if (!Number.isFinite(count) || !Number.isFinite(faces) || count <= 0 || faces <= 0) {
        throw new Error(`Invalid dice term: "${token}"`);
      }
      for (let i = 0; i < count; i++) {
        total += sign * (Math.floor(Math.random() * faces) + 1);
      }
    } else {
      const flat = Number(body);
      if (!Number.isFinite(flat)) throw new Error(`Invalid modifier: "${token}"`);
      total += sign * flat;
    }
  }

  return total;
}

function rollD20(): number {
  return rollDice('1d20');
}

function expireEffects(state: GameState) {
  const turn = state.turnCounter || 0;
  state.activeEffects = (state.activeEffects || []).filter(e => !e.expiresAtTurn || e.expiresAtTurn > turn);
  state.nearbyEntities = (state.nearbyEntities || []).map(ent => ({
    ...ent,
    effects: (ent.effects || []).filter(e => !e.expiresAtTurn || e.expiresAtTurn > turn),
  }));
}

function getPlayerAc(state: GameState, baseAc: number): number {
  const effectBonus = Math.max(
    0,
    ...(state.activeEffects || [])
      .filter(e => e.type === 'ac_bonus' && e.value !== undefined)
      .map(e => e.value as number)
  );
  return baseAc + effectBonus + (state.tempAcBonus || 0);
}

const normalizeSpellName = (name: string | undefined) =>
  (name || '').toLowerCase().replace(/[_-]+/g, ' ').trim();

const normalizeName = (name: string | undefined) =>
  (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
type ActionIntent = 'attack' | 'defend' | 'run' | 'other';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000];
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

function normalizeLocationKey(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim() || 'unknown';
}

function resolveBiomeKey(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes('crypt')) return 'crypt';
  if (lower.includes('sewer') || lower.includes('sewers')) return 'sewers';
  if (lower.includes('courtyard') || lower.includes('gate') || lower.includes('citadel')) return 'fortress';
  if (lower.includes('throne') || lower.includes('catacomb')) return 'catacombs';
  return 'default';
}

function getItemGains(previous: GameState, next: GameState): string[] {
  const prevMap = new Map<string, { name: string; quantity: number }>();
  previous.inventory.forEach(item => {
    prevMap.set(item.name.toLowerCase(), { name: item.name, quantity: item.quantity });
  });

  const gains: string[] = [];
  next.inventory.forEach(item => {
    const key = item.name.toLowerCase();
    const prev = prevMap.get(key);
    const delta = item.quantity - (prev?.quantity ?? 0);
    if (delta > 0) {
      gains.push(delta > 1 ? `${delta}x ${item.name}` : item.name);
    }
  });

  return gains;
}

function buildNarrationContext(
  newState: GameState,
  eventSummary: string,
  mode: NarrationMode,
  previousState?: GameState
): NarrationContext {
  void eventSummary;
  const locationKey = normalizeLocationKey(newState.location);
  const biomeKey = resolveBiomeKey(newState.location);
  const enemyName = newState.nearbyEntities.find(e => e.status === 'alive')?.name;
  const itemNames =
    mode === 'SEARCH_FOUND' || mode === 'LOOT_GAIN'
      ? previousState
        ? getItemGains(previousState, newState)
        : undefined
      : undefined;
  const tookDamage = newState.hp < (previousState?.hp ?? newState.hp);
  const dealtDamage = (newState.lastRolls?.playerDamage || 0) > 0;

  return {
    mode,
    locationKey,
    biomeKey,
    enemyName,
    tookDamage,
    dealtDamage,
    itemNames,
  };
}

function buildInventoryFromEquipment(equipment: string[]): GameState["inventory"] {
  return equipment.map((rawName, idx) => {
    const normalizedKey = rawName.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const weaponRef = weaponsByName[normalizedKey];
    const armorRef = armorByName[normalizedKey];
    const isWeapon = !!weaponRef;
    const isArmor = !!armorRef;
    const type: 'weapon' | 'armor' | 'misc' = isWeapon ? 'weapon' : isArmor ? 'armor' : 'misc';
    const displayName = weaponRef?.name || armorRef?.name || rawName.replace(/_/g, ' ');
    return {
      id: `eq-${idx}-${Date.now().toString(36)}`,
      name: displayName,
      type,
      quantity: 1,
    };
  });
}

function computeBaseAcFromStarter(equipment: string[], abilities: Record<string, number>): number {
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

function applySceneEntry(sceneId: string, baseState: GameState, summaryParts: string[], opts?: { recordHistory?: boolean }): { state: GameState; roomDesc: string } {
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

async function hydrateState(rawState: unknown): Promise<GameState> {
  const normalizedRawState = normalizeLegacyNarrationModes(rawState);
  const parsed = gameStateSchema.safeParse(normalizedRawState);
  if (!parsed.success) {
    throw new Error("Saved game is incompatible with the current version.");
  }
  const state = parsed.data;

  // Ensure we always have a stable world seed for scene/image selection.
  if (!Number.isFinite(state.worldSeed) || state.worldSeed <= 0) {
    state.worldSeed = Math.floor(Math.random() * 999999);
  }

  // Backfill: ensure skills array exists based on class if missing/empty
  if (!state.skills || state.skills.length === 0) {
    const classKey = (state.character?.class || 'fighter').toLowerCase();
    state.skills = getClassReference(classKey).skills;
  }

  // Backfill: ensure spell fields exist
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

  // Backfill: migrate old narrativeHistory into log as summary-only entries
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

  // Rebuild derived assets when missing
  const { url, registry: sceneRegistry } = await resolveSceneImage(state);
  state.currentImage = url;
  state.sceneRegistry = sceneRegistry;

  const { registry: roomRegistry } = await resolveRoomDescription(state);
  state.roomRegistry = roomRegistry;

  return state;
}

// --- RESOLVERS ---
const SCENE_CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB cap for cached scene images
const SCENE_CACHE_MAX_FILES = 250;

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
    // If already cached, just return
    try {
      await fs.access(filePath);
      return `/scene-cache/${fileName}`;
    } catch {
      // proceed to fetch
    }
    const res = await fetch(remoteUrl);
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

async function resolveSceneImage(state: GameState): Promise<{ url: string; registry: Record<string, string> }> {
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
  const stableSeed = subjectHash + variantIndex * 9973; // variant-specific but stable across runs
  const encodedPrompt = encodeURIComponent(visualPrompt + " fantasy oil painting style dark gritty 8k");
  const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=300&nologo=true&seed=${stableSeed}`;
  const fileName = `${sceneKey.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_v${variantIndex}.jpg`;
  const cachedPath = await cacheSceneImage(remoteUrl, fileName);
  const finalUrl = cachedPath || remoteUrl;
  return { url: finalUrl, registry: { ...state.sceneRegistry, [sceneKey]: finalUrl } };
}

async function resolveRoomDescription(state: GameState): Promise<{ desc: string, registry: Record<string, string> }> {
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

// Guardrail: strip control characters and obvious prompt-injection phrases before surfacing user text.
function sanitizeForNarrator(text: string): string {
  if (!text) return "";
  const cleaned = text
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 500);
}

function sanitizeUserAction(text: string): string {
  const cleaned = sanitizeForNarrator(text);
  const injectionPattern = /(ignore|disregard|override|bypass|forget).{0,40}(instruction|system|rule|previous)/i;
  if (injectionPattern.test(cleaned)) return "act cautiously";
  return cleaned || "act";
}

function summarizeInventory(inventory: GameState["inventory"]): { summary: string; items: string[] } {
  if (!inventory || inventory.length === 0) {
    return { summary: "Unarmed; nothing notable carried.", items: [] };
  }

  const primaryWeapon = inventory.find(i => i.type === 'weapon')?.name;
  const armor = inventory.find(i => i.type === 'armor')?.name;
  const extras = inventory
    .filter(i => i.type !== 'weapon' && i.type !== 'armor')
    .slice(0, 1)
    .map(i => i.name);

  const names = [primaryWeapon, armor, ...extras].filter(Boolean) as string[];
  const summary = names.length > 0 ? names.join(' and ') : "Basic gear only.";
  return { summary, items: names };
}

function getSkillModifier(state: GameState, skillName: string): number {
  if (!skillName) return 0;
  const hasSkill = (state.skills || []).some(skill => skill.toLowerCase() === skillName.toLowerCase());
  return hasSkill ? 2 : 0;
}

function pushStoryFlag(state: GameState, flag: string) {
  if (!flag) return;
  const flags = state.storyFlags || [];
  if (!flags.includes(flag)) {
    state.storyFlags = [...flags, flag];
  }
}

function applyStuntEffect(
  state: GameState,
  template: StuntTemplate,
  success: boolean,
  targetName?: string
): string {
  if (success) {
    switch (template.successEffect) {
      case 'knockProne': {
        const targetKey = normalizeName(targetName);
        let didApply = false;
        if (targetKey) {
          state.nearbyEntities = state.nearbyEntities.map(entity => {
            const matches = normalizeName(entity.name).includes(targetKey);
            if (!matches) return entity;
            didApply = true;
            return {
              ...entity,
              effects: [
                ...(entity.effects || []),
                { name: 'Prone', type: 'debuff', expiresAtTurn: (state.turnCounter || 0) + 1 },
              ],
            };
          });
        }
        return didApply
          ? `${targetName ? `The ${targetName}` : 'Your target'} is knocked prone.`
          : 'You knock your target off balance.';
      }
      case 'extraDamage':
        state.activeEffects = [
          ...(state.activeEffects || []),
          { name: 'Stunt Edge', type: 'buff', value: 2, expiresAtTurn: (state.turnCounter || 0) + 1 },
        ];
        return 'You set up an opening for a stronger strike.';
      case 'discoverClue':
        pushStoryFlag(state, 'stunt_clue_found');
        return 'You notice a subtle detail you missed before.';
      case 'gainInfo':
        pushStoryFlag(state, 'stunt_info_gained');
        return 'You piece together a useful insight.';
      case 'improveAttitude':
        pushStoryFlag(state, 'stunt_attitude_improved');
        return 'The tension eases, if only slightly.';
      case 'advantage':
        state.activeEffects = [
          ...(state.activeEffects || []),
          { name: 'Stunt Advantage', type: 'buff', expiresAtTurn: (state.turnCounter || 0) + 1 },
        ];
        return 'You gain a brief edge in the next exchange.';
    }
  } else {
    switch (template.failureEffect) {
      case 'takeDamage': {
        const dmg = rollDice('1d4');
        state.hp = Math.max(0, state.hp - dmg);
        return `You overextend and take ${dmg} damage.`;
      }
      case 'losePosition':
        pushStoryFlag(state, 'stunt_lost_position');
        return 'You lose your footing and give ground.';
      case 'alertEnemies':
        pushStoryFlag(state, 'stunt_alerted_enemies');
        return 'Your misstep draws unwanted attention.';
      case 'worsenAttitude':
        pushStoryFlag(state, 'stunt_attitude_worsened');
        return 'Your words sour the mood.';
      case 'wasteAction':
        return 'The attempt goes nowhere.';
      case 'noEffect':
        return '';
    }
  }
  return '';
}

function resolveStunt(
  currentState: GameState,
  stunt: ClassifiedStunt
): { summary: string; mode: NarrationMode } {
  const { template, targetName } = stunt;
  const dc = DIFFICULTY_TO_DC[template.baseDifficulty];
  const skillName = template.primarySkill;
  const skillMod = getSkillModifier(currentState, skillName);
  const roll = rollD20();
  const total = roll + skillMod;
  const success = total >= dc;
  const resultWord = success ? 'succeed' : 'fail';
  const targetText = targetName ? ` targeting the ${targetName}` : '';

  let mode: NarrationMode = 'GENERAL';
  if (template.category === 'combat' || template.category === 'physical') {
    mode = success ? 'COMBAT_HIT' : 'COMBAT_MISS';
  } else if (template.category === 'mental' || template.category === 'exploration') {
    mode = 'INVESTIGATE';
  }

  let summary =
    `You attempt a ${template.category} stunt${targetText} using ${skillName}. ` +
    `You roll ${total} vs DC ${dc} and ${resultWord}.`;

  const consequenceText = applyStuntEffect(currentState, template, success, targetName);
  if (consequenceText) {
    summary += ` ${consequenceText}`;
  }

  return { summary, mode };
}

function buildAccountantFacts(params: {
  newState: GameState;
  previousState: GameState;
  roomDesc: string;
  engineFacts: string[];
  includeLocation?: boolean;
}) {
  const { newState, previousState, roomDesc, engineFacts, includeLocation = true } = params;
  const facts: string[] = [];

  const trimmedFacts = engineFacts.map(f => sanitizeForNarrator(f)).filter(Boolean);
  facts.push(...trimmedFacts);

  if (includeLocation) facts.push(sanitizeForNarrator(`Location: ${newState.location}. ${roomDesc}`));

  const hpDelta = newState.hp - previousState.hp;
  let hpDeltaNote = "";
  if (hpDelta > 0) {
    hpDeltaNote = ` (healed ${hpDelta})`;
  } else if (hpDelta < 0) {
    const incoming = newState.lastRolls?.monsterDamage || 0;
    const displayLoss = incoming > 0 ? incoming : Math.abs(hpDelta);
    hpDeltaNote = ` (lost ${displayLoss})`;
  }
  facts.push(sanitizeForNarrator(`You are at ${newState.hp}/${newState.maxHp} HP${hpDeltaNote}, AC ${newState.ac}.`));

  const threats = newState.nearbyEntities.map(e =>
    `${e.name} ${e.status}${e.status !== 'dead' ? ` (${e.hp}/${e.maxHp} HP)` : ''}`
  ).join('; ');
  if (threats) {
    const threatLine = sanitizeForNarrator(`Nearby: ${threats}.`);
    if (threatLine) facts.push(threatLine);
  }

  const { summary: inventorySummaryRaw, items: allowedItems } = summarizeInventory(newState.inventory);
  const inventorySummary = sanitizeForNarrator(inventorySummaryRaw);

  const cleanedFacts = facts.filter(Boolean);
  return {
    facts: cleanedFacts,
    eventSummary: cleanedFacts.join(' '),
    inventorySummary,
    allowedItems,
  };
}

function getWeaponDamageDice(name: string | undefined): string {
  if (!name) return "1d4";
  const weapon = weaponsByName[name.toLowerCase()];
  if (weapon?.damage) {
    const diceMatch = weapon.damage.match(/\d+d\d+/i);
    if (diceMatch) return diceMatch[0];
    const flatMatch = weapon.damage.match(/\d+/);
    if (flatMatch) return flatMatch[0];
  }
  return WEAPON_TABLE[name] || "1d4";
}

function isWeaponAllowedForClass(weaponName: string | undefined, classKey: string): boolean {
  if (!weaponName) return false;
  const ref = getClassReference(classKey);
  return ref.allowedWeapons.map(w => w.toLowerCase()).includes(weaponName.toLowerCase());
}

// --- MAIN LOGIC ENGINE ---
// DM principles: describe what the player perceives, let the player act, resolve fairly.
async function _updateGameState(
  currentState: GameState,
  userAction: string
): Promise<{
  newState: GameState;
  roomDesc: string;
  accountantFacts: string[];
  eventSummary: string;
  narrationMode: NarrationMode;
}> {
  // 1. DETERMINE PLAYER WEAPON & DAMAGE
  const classKey = (currentState.character?.class || 'fighter').toLowerCase();
  const spellCatalog = classKey === 'cleric' ? clericSpellsByName : wizardSpellsByName;
  const parsedIntent: ParsedIntent = parseActionIntentWithKnown(
    userAction,
    currentState.knownSpells || [],
    Object.keys(spellCatalog)
  );
  const actionIntent: ActionIntent =
    parsedIntent.type === 'attack' || parsedIntent.type === 'castAbility'
      ? 'attack'
      : parsedIntent.type === 'defend'
      ? 'defend'
      : parsedIntent.type === 'run'
      ? 'run'
      : 'other';

  const preferredWeaponName = parsedIntent.type === 'attack' && parsedIntent.weaponName
    ? parsedIntent.weaponName
    : currentState.inventory.find(i => i.type === 'weapon')?.name;

  let weaponName = preferredWeaponName || "Fists";
  let playerDmgDice = getWeaponDamageDice(weaponName);
  const weaponAllowed = isWeaponAllowedForClass(weaponName, classKey);
  if (!weaponAllowed && weaponName !== "Fists") {
    playerDmgDice = "1d4";
    weaponName = "Fists";
  }

  // 2. PREP STATE
  const newState: GameState = {
    ...currentState,
    inventory: currentState.inventory.map(i => ({ ...i })),
    quests: currentState.quests.map(q => ({ ...q })),
    nearbyEntities: currentState.nearbyEntities.map(e => ({ ...e })),
    roomRegistry: { ...currentState.roomRegistry },
    sceneRegistry: { ...currentState.sceneRegistry },
    tempAcBonus: 0,
    narrativeHistory: [...(currentState.narrativeHistory || [])],
    locationHistory: [...(currentState.locationHistory || [])],
    inventoryChangeLog: [...(currentState.inventoryChangeLog || [])],
    log: [...(currentState.log || [])],
  };

  // Advance turn counter and clear expired effects before resolving actions
  newState.turnCounter = (currentState.turnCounter || 0) + 1;
  expireEffects(newState);

  let currentScene = getSceneById(currentState.storySceneId);
  if (!currentScene && newState.location.toLowerCase().includes('gate')) {
    currentScene = getSceneById('iron_gate_v1') || pickSceneVariant('act1_gate', newState.worldSeed);
  }

  // 2a. Scene exit transitions before other actions
  const sceneExit = currentScene?.exits?.find(ex => ex.verb.some(v => userAction.toLowerCase().includes(v)));
  if (sceneExit) {
    const aliveThreat = newState.nearbyEntities.some(e => e.status === 'alive');
    if (aliveThreat) {
      newState.lastActionSummary = "You cannot leave while threats remain.";
      return { newState, roomDesc: newState.roomRegistry[newState.location] || "", accountantFacts: ["You cannot leave while threats remain."], eventSummary: newState.lastActionSummary, narrationMode: "GENERAL" };
    }
    if (sceneExit.consumeItem) {
      const hasItem = newState.inventory.some(i => i.name.toLowerCase() === sceneExit.consumeItem!.toLowerCase());
      if (!hasItem) {
        newState.lastActionSummary = `You need ${sceneExit.consumeItem} to proceed.`;
        return { newState, roomDesc: newState.roomRegistry[newState.location] || "", accountantFacts: [newState.lastActionSummary], eventSummary: newState.lastActionSummary, narrationMode: "GENERAL" };
      }
      newState.inventory = newState.inventory.filter(i => i.name.toLowerCase() !== sceneExit.consumeItem!.toLowerCase());
    }
    let target = getSceneById(sceneExit.targetSceneId);
    if (!target && (currentScene?.location.toLowerCase().includes('gate') || currentScene?.id.includes('gate'))) {
      target = pickSceneVariant('act1_courtyard', newState.worldSeed) || getSceneById('courtyard_v1');
    }
    if (target) {
      const summaryParts: string[] = [];
      if (sceneExit.log) summaryParts.push(sceneExit.log);
      const { state: transitioned, roomDesc } = applySceneEntry(target.id, newState, summaryParts);
      transitioned.lastActionSummary = summaryParts.join(' ').trim() || `You move to ${target.location}.`;
      return { newState: transitioned, roomDesc, accountantFacts: summaryParts, eventSummary: transitioned.lastActionSummary, narrationMode: "ROOM_INTRO" };
    }
  }

  // 3. ACTIVE MONSTER CONTEXT
  const activeMonsterIndex = newState.nearbyEntities.findIndex(e => e.status === 'alive');
  const activeMonster = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;

  // 4. PLAYER TURN
  let playerAttackRoll = 0;
  let playerDamageRoll = 0;
  const summaryParts: string[] = [];
  const safeUserAction = sanitizeUserAction(userAction);
  let combatOutcome: 'hit' | 'miss' | 'kill' | null = null;
  let attemptedSearch = false;
  let attemptedLoot = false;
  let foundSearchItems = false;
  let foundLootItems = false;
  let attemptedInvestigate = false;
  let lookedAround = false;
  let stuntModeOverride: NarrationMode | null = null;
  const wantsSearch = /(search|rummage|scour|sift|probe)/i.test(userAction);
  const wantsInvestigate = /(investigate|inspect|examine)/i.test(userAction);

  const monsterWasAlive = activeMonster?.status === 'alive';
  const applyDamageToActiveMonster = (damage: number) => {
    if (!activeMonster) return;
    const updatedHp = Math.max(0, activeMonster.hp - damage);
    newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
      idx === activeMonsterIndex
        ? { ...activeMonster, hp: updatedHp, status: updatedHp <= 0 ? 'dead' : activeMonster.status }
        : entity
    );
    combatOutcome = updatedHp <= 0 ? 'kill' : 'hit';
  };

  attemptedSearch = wantsSearch;
  attemptedInvestigate = wantsInvestigate;

  // Quick-use bandages (healing consumable)
  const wantsBandage = /bandage/i.test(userAction);
  const bandageIdx = newState.inventory.findIndex(i => i.name.toLowerCase().includes('bandage') && i.quantity > 0);
  let handledBandage = false;
  if (wantsBandage) {
    handledBandage = true;
    if (bandageIdx >= 0) {
      const heal = 6;
      newState.hp = Math.min(newState.maxHp, newState.hp + heal);
      const item = newState.inventory[bandageIdx];
      const remainingQty = Math.max(0, item.quantity - 1);
      if (remainingQty <= 0) {
        newState.inventory = newState.inventory.filter((_, idx) => idx !== bandageIdx);
      } else {
        newState.inventory = newState.inventory.map((it, idx) => idx === bandageIdx ? { ...it, quantity: remainingQty } : it);
      }
      newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used bandage (${heal} HP) at ${newState.location}`].slice(-10);
      summaryParts.push(`You apply a bandage, recovering ${heal} HP.`);
    } else {
      summaryParts.push("You fumble for a bandage, but you have none left.");
    }
  }

  if (!handledBandage) {
  if (parsedIntent.type === 'castAbility') {
    const spellKey = parsedIntent.abilityName.toLowerCase();
    const normalizedKey = normalizeSpellName(spellKey);
    const spell = spellCatalog[normalizedKey] || spellCatalog[spellKey];
    const isKnown = (newState.knownSpells || []).some(s => normalizeSpellName(s) === normalizedKey);
    const isPrepared = (newState.preparedSpells || []).some(s => normalizeSpellName(s) === normalizedKey);
    let canCast = true;

    if (!spell || !isKnown) {
      summaryParts.push(`You have not learned that spell.`);
      canCast = false;
    } else if (!isPrepared && !spell.level.toLowerCase().includes('cantrip')) {
      summaryParts.push(`You have not prepared ${spell.name}.`);
      canCast = false;
    } else {
      const isCantrip = spell.level.toLowerCase().includes('cantrip');
      const slotKey = 'level_1';
      const slots = newState.spellSlots || {};
      if (!isCantrip) {
        const slot = slots[slotKey];
        if (!slot || slot.current <= 0) {
          summaryParts.push(`You have no ${slotKey.replace('_', ' ')} spell slots left.`);
          canCast = false;
        } else {
          slots[slotKey] = { ...slot, current: slot.current - 1 };
          newState.spellSlots = slots;
        }
      }

      if (canCast) {
        // Resolve a minimal set of spells
        const targetName = parsedIntent.target || activeMonster?.name || 'the area';
        const lowerSpell = spell.name.toLowerCase();
        if (lowerSpell === 'magic missile') {
          const dmg = rollDice("1d4+1");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`You cast Magic Missile at ${targetName}, dealing ${dmg} force damage.`);
        } else if (lowerSpell === 'guiding bolt') {
          const dmg = rollDice("4d6");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`You hurl a lance of radiant light at ${targetName}, dealing ${dmg} radiant damage.`);
        } else if (lowerSpell === 'thunderwave') {
          const dmg = rollDice("2d8");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`You unleash Thunderwave at ${targetName}, dealing ${dmg} thunder damage.`);
        } else if (lowerSpell === 'fire bolt') {
          const dmg = rollDice("1d10");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`You hurl a Fire Bolt at ${targetName}, dealing ${dmg} fire damage.`);
        } else if (lowerSpell === 'ray of frost') {
          const dmg = rollDice("1d8");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`You cast Ray of Frost at ${targetName}, dealing ${dmg} cold damage.`);
        } else if (lowerSpell === 'sacred flame') {
          const dmg = rollDice("1d8");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`Radiant fire sears ${targetName}, dealing ${dmg} radiant damage.`);
        } else if (lowerSpell === 'word of radiance') {
          const dmg = rollDice("1d6");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`You utter a searing word; ${targetName} takes ${dmg} radiant damage.`);
        } else if (lowerSpell === 'toll the dead') {
          const dmg = rollDice("1d12");
          applyDamageToActiveMonster(dmg);
          summaryParts.push(`A mournful toll rings out; ${targetName} suffers ${dmg} necrotic damage.`);
        } else if (lowerSpell === 'shield') {
          newState.activeEffects = [
            ...(newState.activeEffects || []),
            { name: 'Shield', type: 'ac_bonus', value: 5, expiresAtTurn: (newState.turnCounter || 0) + 1 }
          ];
          summaryParts.push(`You raise Shield, gaining +5 AC until the start of your next turn.`);
        } else if (lowerSpell === 'mage armor') {
          const targetAc = Math.max(newState.ac, 13);
          newState.ac = targetAc;
          newState.activeEffects = [
            ...(newState.activeEffects || []),
            { name: 'Mage Armor', type: 'buff', expiresAtTurn: undefined }
          ];
          summaryParts.push(`You ward yourself with Mage Armor, hardening your defenses.`);
        } else if (lowerSpell === 'shield of faith') {
          newState.activeEffects = [
            ...(newState.activeEffects || []),
            { name: 'Shield of Faith', type: 'ac_bonus', value: 2, expiresAtTurn: (newState.turnCounter || 0) + 3 }
          ];
          summaryParts.push(`A shimmering field surrounds you, granting +2 AC for a short while.`);
        } else if (lowerSpell === 'bless') {
          newState.activeEffects = [
            ...(newState.activeEffects || []),
            { name: 'Bless', type: 'buff', expiresAtTurn: (newState.turnCounter || 0) + 5 }
          ];
          summaryParts.push(`You bless your efforts, guiding your strikes and resolve.`);
        } else if (lowerSpell === 'cure wounds') {
          const heal = rollDice("1d8") + 2;
          newState.hp = Math.min(newState.maxHp, newState.hp + heal);
          summaryParts.push(`Healing energy knits flesh; you recover ${heal} HP.`);
        } else if (lowerSpell === 'healing word') {
          const heal = rollDice("1d4") + 2;
          newState.hp = Math.min(newState.maxHp, newState.hp + heal);
          summaryParts.push(`You speak a word of restoration, recovering ${heal} HP.`);
        } else if (lowerSpell === 'mage hand') {
          if (activeMonster) {
            newState.nearbyEntities = newState.nearbyEntities.map((entity, idx) =>
              idx === activeMonsterIndex
                ? { ...activeMonster, effects: [...(activeMonster.effects || []), { name: 'Mage Hand', type: 'debuff', expiresAtTurn: (newState.turnCounter || 0) + 2 }] }
                : entity
            );
            summaryParts.push(`A spectral hand clamps onto ${targetName}, pinning it for the next moments.`);
          } else {
            summaryParts.push("A spectral hand flickers into being, grasping at loose debris.");
          }
        } else if (spell.name.toLowerCase() === 'detect magic') {
          summaryParts.push(`You attune your senses; lingering magic hums in the air.`);
        } else if (spell.name.toLowerCase() === 'identify') {
          summaryParts.push(`You focus to identify an item or effect; details surface in your mind.`);
        } else {
          summaryParts.push(`You cast ${spell.name}, but its effect is not modeled yet.`);
        }
      }
    }
  } else if (parsedIntent.type === 'look') {
    lookedAround = true;
    const threats = newState.nearbyEntities.filter(e => e.status === 'alive');
    const threatText = threats.length > 0
      ? `You spot ${threats.map(e => `${e.name} (${e.hp}/${e.maxHp} HP)`).join(', ')}.`
      : "No immediate threats.";
    summaryParts.push(`You look around ${newState.location}. ${threatText}`);
    const exits = (getSceneById(newState.storySceneId)?.exits || currentScene?.exits || []);
    if (exits.length > 0) {
      const exitText = exits.map(ex => {
        const target = getSceneById(ex.targetSceneId);
        const label = target?.location || target?.title || ex.targetSceneId;
        const verb = ex.verb[0];
        return `${verb} → ${label}`;
      }).join('; ');
      summaryParts.push(`Exits: ${exitText}.`);
    }
  } else if (actionIntent === 'attack' && activeMonster) {
    playerAttackRoll = Math.floor(Math.random() * 20) + 1; // no bonus for now
    if (playerAttackRoll >= activeMonster.ac) {
      playerDamageRoll = rollDice(playerDmgDice);
      applyDamageToActiveMonster(playerDamageRoll);
      summaryParts.push(`You hit ${activeMonster.name} with ${weaponName} for ${playerDamageRoll} damage (roll ${playerAttackRoll} vs AC ${activeMonster.ac}).`);
    } else {
      combatOutcome = 'miss';
      summaryParts.push(`You miss ${activeMonster.name} (roll ${playerAttackRoll} vs AC ${activeMonster.ac}).`);
    }
  } else if (actionIntent === 'defend') {
    newState.tempAcBonus = 4;
    summaryParts.push("You brace for impact, raising your guard.");
  } else if (actionIntent === 'run') {
    newState.nearbyEntities = [];
    newState.isCombatActive = false;
    summaryParts.push("You flee the encounter.");
  } else if (parsedIntent.type === 'checkSheet') {
    const skills = newState.skills?.length ? newState.skills.join(', ') : 'None';
    const primaryWeapon = newState.inventory.find(i => i.type === 'weapon')?.name || 'None';
    const armor = newState.inventory.find(i => i.type === 'armor')?.name || 'None';
    const known = newState.knownSpells?.length ? newState.knownSpells.join(', ') : 'None';
    const prepared = newState.preparedSpells?.length ? newState.preparedSpells.join(', ') : 'None';
    const slotText = Object.entries(newState.spellSlots || {})
      .map(([lvl, data]) => `${lvl.replace('_', ' ')}: ${data.current}/${data.max}`)
      .join('; ');
    summaryParts.push(`Skills: ${skills}. Equipped weapon: ${primaryWeapon}. Armor: ${armor}. Spells known: ${known}. Spells prepared: ${prepared}. Slots: ${slotText || 'None'}.`);
  } else {
    const stunt = classifyStunt(userAction);
    if (stunt) {
      const { summary, mode } = resolveStunt(newState, stunt);
      stuntModeOverride = mode;
      summaryParts.push(summary);
    } else if (actionIntent === 'other' && newState.nearbyEntities.length === 0) {
      summaryParts.push("You act, but there is no immediate threat here.");
    } else if (actionIntent === 'attack' && !activeMonster) {
      summaryParts.push("You swing, but no foe stands before you.");
    } else {
      summaryParts.push(`You ${safeUserAction}.`);
    }
  }
  } // end handledBandage guard

  // 5. MONSTER TURN (only if still present and player didn't run)
  let monsterAttackRoll = 0;
  let monsterDamageRoll = 0;
  let monsterDamageNotation = "";
  const currentActiveMonster = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;
  const monsterStillAlive = currentActiveMonster && currentActiveMonster.status === 'alive';
  const monsterIsActive = newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend';
  if (monsterStillAlive && monsterIsActive && actionIntent !== 'run') {
    const monsterHasMageHand = (currentActiveMonster.effects || []).some(e => e.name.toLowerCase() === 'mage hand');
    if (monsterHasMageHand) {
      summaryParts.push(`${currentActiveMonster.name} struggles against the spectral hand and cannot attack this moment.`);
    } else {
      monsterAttackRoll = Math.floor(Math.random() * 20) + 1 + currentActiveMonster.attackBonus;
      monsterDamageNotation = currentActiveMonster.damageDice;
      const playerAc = getPlayerAc(newState, newState.ac);
      if (monsterAttackRoll >= playerAc) {
        monsterDamageRoll = rollDice(monsterDamageNotation);
        newState.hp = Math.max(0, newState.hp - monsterDamageRoll);
        summaryParts.push(`${currentActiveMonster.name} hits you for ${monsterDamageRoll} damage (roll ${monsterAttackRoll} vs AC ${playerAc}).`);
      } else {
        summaryParts.push(`${currentActiveMonster.name} misses you (roll ${monsterAttackRoll} vs AC ${playerAc}).`);
      }
    }
  } else if (!monsterStillAlive && actionIntent === 'attack' && parsedIntent.type !== 'castAbility') {
    summaryParts.push("There is nothing left to attack.");
  }

  // 6. CLEANUP COMBAT FLAGS
  newState.tempAcBonus = 0;
  const anyAlive = newState.nearbyEntities.some(e => e.status === 'alive');
  newState.isCombatActive = (anyAlive && (newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend')) && newState.hp > 0;
  newState.nearbyEntities = [...newState.nearbyEntities];

  // 6a. LOOTING / KEY RECOVERY (simple heuristic for the Iron Key at the gate)
  const wantsKey = /(key|glint|shiny|metal|object|take|grab|pick|retrieve)/i.test(userAction) && newState.location.toLowerCase().includes('gate');
  if (wantsKey) attemptedSearch = true;
  const hasIronKey = newState.inventory.some(i => i.name === 'Iron Key');
  if (wantsKey && !hasIronKey) {
    newState.inventory = [
      ...newState.inventory,
      { id: `key-${Date.now().toString(36)}`, name: 'Iron Key', type: 'key', quantity: 1 }
    ];
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Gained Iron Key at ${newState.location}`].slice(-10);
    summaryParts.push("You recover the Iron Key from the debris.");
    foundSearchItems = true;
    // Once the key is taken, nearby rats lose interest
    newState.nearbyEntities = newState.nearbyEntities.map(ent =>
      ent.name.toLowerCase().includes('rat')
        ? { ...ent, status: ent.status === 'alive' ? 'fleeing' : ent.status }
        : ent
    );
    newState.isCombatActive = newState.nearbyEntities.some(e => e.status === 'alive' && e.hp > 0) && newState.hp > 0;
  }

  // 6b. TRACK LOCATION HISTORY
  if (newState.location !== currentState.location) {
    const history = newState.locationHistory || [];
    const updatedHistory = [...history, newState.location].slice(-10);
    newState.locationHistory = updatedHistory;
  }

  // 7. STORY ACT BOUNDS
  const maxAct = Math.max(...Object.keys(STORY_ACTS).map(Number));
  newState.storyAct = Math.min(maxAct, Math.max(0, newState.storyAct));

  // 8. XP & LEVEL
  const monsterNow = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;
  const monsterKilled = monsterWasAlive && monsterNow && monsterNow.status === 'dead';
  if (monsterKilled) {
    const xpAward = MONSTER_MANUAL[activeMonster!.name]?.hp ? Math.max(25, MONSTER_MANUAL[activeMonster!.name].hp * 5) : 50;
    newState.xp += xpAward;
    summaryParts.push(`You gain ${xpAward} XP.`);
  }

  // Scene completion rewards
  const sceneForReward = getSceneById(newState.storySceneId);
  const sceneCleared = !newState.nearbyEntities.some(e => e.status === 'alive');
  if (sceneForReward?.onComplete?.flagsSet && sceneCleared) {
    const newFlags = sceneForReward.onComplete.flagsSet.filter(f => !(newState.storyFlags || []).includes(f));
    if (newFlags.length > 0) {
      newState.storyFlags = [...(newState.storyFlags || []), ...newFlags];
      const rewardXp = sceneForReward.onComplete.reward?.xp || 0;
      if (rewardXp > 0) {
        newState.xp += rewardXp;
        summaryParts.push(`You gain ${rewardXp} XP for securing ${sceneForReward.title || sceneForReward.location}.`);
      }
      const lootTable = sceneForReward.onComplete.reward?.lootTable;
      if (lootTable) {
        const loot = rollLoot(lootTable);
        if (loot) {
          const coinGain = Object.entries(loot.coins).filter(([, v]) => (v || 0) > 0);
          if (coinGain.length > 0) {
            const gold = loot.coins.gp || 0;
            const silver = loot.coins.sp || 0;
            const copper = loot.coins.cp || 0;
            if (gold > 0) newState.gold += gold;
            summaryParts.push(`You recover ${gold ? gold + ' gp' : ''}${gold && (silver || copper) ? ', ' : ''}${silver ? silver + ' sp' : ''}${silver && copper ? ', ' : ''}${(!gold && !silver && copper) ? `${copper} cp` : ''}`.trim().replace(/, $/, ''));
          }
          if (loot.items.length > 0) {
            const newItems = loot.items.map(it => ({
              id: `loot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
              name: it.id.replace(/_/g, ' '),
              type: 'misc' as const,
              quantity: it.quantity,
            }));
            newState.inventory = [...newState.inventory, ...newItems];
            newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Scene loot: ${newItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`].slice(-10);
            summaryParts.push(`Loot found: ${newItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}.`);
          }
        }
      }
    }
  }

  let leveled = false;
  while (newState.level < XP_THRESHOLDS.length && newState.xp >= XP_THRESHOLDS[newState.level]) {
    newState.level += 1;
    newState.xpToNext = XP_THRESHOLDS[newState.level] ?? newState.xpToNext;
    // Simple HP bump per level
    newState.maxHp += 2;
    newState.hp = Math.max(newState.hp, newState.maxHp);
    leveled = true;
  }
  if (leveled) summaryParts.push(`You reach level ${newState.level}.`);

  // 8b. LOOT CORPSES (simple generic loot)
  const wantsLoot = /(loot|rummage|pick over|salvage)/i.test(userAction);
  attemptedLoot = wantsLoot;
  const deadCorpse = newState.nearbyEntities.find(e => e.status === 'dead' && !e.name.toLowerCase().includes('looted'));
  if (wantsLoot && deadCorpse) {
    const monsterLootMap: Record<string, string> = {
      'skeleton': '5e_minor_undead_treasure',
      'zombie': '5e_minor_undead_treasure',
      'skeleton archer': '5e_minor_undead_treasure',
      'armoured zombie': '5e_minor_undead_treasure',
      'fallen knight': '5e_major_undead_boss_treasure',
      'cultist acolyte': '5e_minor_cultist_treasure',
    };
    const corpseKey = normalizeName(deadCorpse.name);
    let table = monsterLootMap[corpseKey] || Object.entries(monsterLootMap).find(([key]) => corpseKey.includes(key))?.[1];
    if (!table) {
      if (corpseKey.includes('skeleton') || corpseKey.includes('zombie')) table = '5e_minor_undead_treasure';
      if (corpseKey.includes('cultist')) table = table || '5e_minor_cultist_treasure';
    }
    const loot = table ? rollLoot(table) : null;
    let goldFind = 0;
    const newItems: GameState['inventory'] = [];
    if (loot) {
      goldFind = loot.coins.gp || 0;
      if (goldFind > 0) newState.gold += goldFind;
      if (loot.items.length > 0) {
        for (const it of loot.items) {
          newItems.push({
            id: `loot-${Date.now().toString(36)}`,
            name: it.id.replace(/_/g, ' '),
            type: 'misc',
            quantity: it.quantity,
          });
        }
      }
    } else {
      goldFind = Math.max(1, Math.floor(Math.random() * 6));
      newItems.push({
        id: `loot-${Date.now().toString(36)}`,
        name: `${deadCorpse.name} Remnant`,
        type: 'misc',
        quantity: 1,
      });
      newState.gold += goldFind;
    }
    newState.inventory = [...newState.inventory, ...newItems];
    foundLootItems = goldFind > 0 || newItems.length > 0;
    // Mark corpse as looted
    newState.nearbyEntities = newState.nearbyEntities.map(e =>
      e === deadCorpse ? { ...e, name: `${e.name} (looted)` } : e
    );
    newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Looted ${deadCorpse.name}: +${goldFind} gold${newItems.length ? ', +' + newItems.map(i => `${i.quantity}x ${i.name}`).join(', ') : ''}`].slice(-10);
    const parts = [];
    if (goldFind > 0) parts.push(`${goldFind} gold`);
    if (newItems.length > 0) parts.push(newItems.map(i => `${i.quantity}x ${i.name}`).join(', '));
    summaryParts.push(`You loot the ${deadCorpse.name}${parts.length ? ', gaining ' + parts.join(' and ') : '.'}`);
  }

  // 9. SUMMARY & ROLLS
  newState.lastActionSummary = summaryParts.join(' ').trim() || "Nothing of note happens.";
  newState.lastRolls = {
    playerAttack: playerAttackRoll,
    playerDamage: playerDamageRoll,
    monsterAttack: monsterAttackRoll,
    monsterDamage: monsterDamageRoll,
  };

  // 9. UPDATE ROOM + IMAGE REGISTRIES
  const { desc: finalDesc, registry: textReg } = await resolveRoomDescription(newState);
  newState.roomRegistry = textReg;

  const { url, registry: imgReg } = await resolveSceneImage(newState);
  newState.currentImage = url;
  newState.sceneRegistry = imgReg;

  const isNewLocation = newState.location !== currentState.location;
  const isSheet = parsedIntent.type === 'checkSheet';
  const resolvedCombatOutcome = combatOutcome as 'hit' | 'miss' | 'kill' | null;

  let narrationMode: NarrationMode = "GENERAL";
  if (isSheet) narrationMode = "SHEET";
  else if (stuntModeOverride) narrationMode = stuntModeOverride;
  else if (resolvedCombatOutcome === 'kill') narrationMode = "COMBAT_KILL";
  else if (resolvedCombatOutcome === 'hit') narrationMode = "COMBAT_HIT";
  else if (resolvedCombatOutcome === 'miss') narrationMode = "COMBAT_MISS";
  else if (foundLootItems) narrationMode = "LOOT_GAIN";
  else if (foundSearchItems) narrationMode = "SEARCH_FOUND";
  else if (attemptedInvestigate) narrationMode = "INVESTIGATE";
  else if (lookedAround || isNewLocation) narrationMode = "ROOM_INTRO";
  else if (attemptedLoot || attemptedSearch) narrationMode = "SEARCH_EMPTY";

  return { newState, roomDesc: finalDesc, accountantFacts: [...summaryParts], eventSummary: newState.lastActionSummary, narrationMode };
}

// --- EXPORT 1: CREATE NEW GAME ---
type CreateOptions = { archetypeKey?: keyof typeof ARCHETYPES; forceNew?: boolean };

export async function createNewGame(opts?: CreateOptions): Promise<GameState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const archetypeKey = opts?.archetypeKey;
  const forceNew = opts?.forceNew ?? false;

  const { data: existingSave } = await supabase.from('saved_games').select('game_state').eq('user_id', user.id).single();
  if (existingSave?.game_state && !forceNew) {
    const hydrated = await hydrateState(existingSave.game_state);
    const { error: updateError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: hydrated }, { onConflict: 'user_id' });
    if (updateError) console.error("Failed to update existing save:", updateError);
    return hydrated;
  }

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
 	    { id: '1', name: startingWeapon, type: 'weapon', quantity: 1 },
	    ...(startingArmor
        ? [{ id: 'armor-1', name: startingArmor, type: 'armor' as const, quantity: 1 }]
        : []),
	  ];
  let knownSpells: string[] = [];
  let preparedSpells: string[] = [];
  let spellSlots: Record<string, { max: number; current: number }> = {};
  let spellcastingAbility = 'int';
  let spellAttackBonus = 0;
  let spellSaveDc = 0;

  const starter = starterCharacters.find(c => c.class.toLowerCase() === (archetypeKey || 'fighter')) || starterCharacters[0];
  if (starter) {
    initialHp = starter.max_hp;
    initialAc = computeBaseAcFromStarter(starter.equipment, starter.abilities || {});
    skills = starter.skills;
    inventory = buildInventoryFromEquipment(starter.equipment);
    inventory = [
      ...inventory,
      { id: `bandage-${Date.now().toString(36)}`, name: 'Bandage', type: 'misc', quantity: 2 },
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

  const baseState: GameState = {
    hp: initialHp, maxHp: initialHp, ac: initialAc, tempAcBonus: 0, gold: 0,
    level: 1, xp: 0, xpToNext: XP_THRESHOLDS[1],
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
    skills,
    knownSpells,
    preparedSpells,
    spellSlots,
    spellcastingAbility,
    spellAttackBonus,
    spellSaveDc,
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
    },
    isCombatActive: false,
    storySceneId: gateScene?.id || 'iron_gate_v1',
    storyFlags: [],
    turnCounter: 0,
    activeEffects: [],
  };

  const entrySummary: string[] = [];
  const { state: seededState } = applySceneEntry(baseState.storySceneId, baseState, entrySummary);
  seededState.lastActionSummary = entrySummary.join(' ').trim() || baseState.lastActionSummary;

  const { url, registry } = await resolveSceneImage(seededState);
  seededState.currentImage = url;
  seededState.sceneRegistry = registry;

  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: seededState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save new game: ${saveError.message}`);
  return seededState;
}

// --- EXPORT 2: PROCESS TURN ---
export async function processTurn(currentState: GameState, userAction: string): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { newState, roomDesc, accountantFacts: engineFacts, eventSummary, narrationMode } = await _updateGameState(currentState, userAction);

  const locationDescription = newState.roomRegistry[newState.location] || roomDesc || "An undefined space.";
  const { facts, eventSummary: accountantSummary } = buildAccountantFacts({
    newState,
    previousState: currentState,
    roomDesc: locationDescription,
    engineFacts,
    includeLocation: newState.location !== currentState.location || ["SEARCH_FOUND", "SEARCH_EMPTY", "ROOM_INTRO", "INVESTIGATE", "LOOT_GAIN"].includes(narrationMode),
  });

  let factBlock = facts.join('\n');
  let skipFlavor = false;

  if (["SEARCH_FOUND", "SEARCH_EMPTY", "ROOM_INTRO", "INVESTIGATE"].includes(narrationMode)) {
    const lastSummary = newState.log?.slice(-1)[0]?.summary;
    if (lastSummary && lastSummary === factBlock) {
      factBlock = "You scan the area again; nothing seems to have changed.";
      skipFlavor = true;
    }
  }

  const narrationCtx = buildNarrationContext(newState, accountantSummary, narrationMode, currentState);
  const flavorLine = skipFlavor ? null : generateCannedFlavor(narrationCtx);

  const combinedNarrative = flavorLine ? `${factBlock}\n\n${flavorLine}` : factBlock;

  const logEntry: LogEntry = {
    summary: factBlock || eventSummary,
    flavor: flavorLine || undefined,
    mode: narrationMode,
    createdAt: new Date().toISOString(),
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  };

  newState.log = [...(newState.log || []), logEntry].slice(-50);
  newState.narrativeHistory = [...newState.narrativeHistory, combinedNarrative].slice(-3);

  const { error: saveError } = await supabase.from('saved_games').upsert({ user_id: user.id, game_state: newState }, { onConflict: 'user_id' });
  if (saveError) throw new Error(`Failed to save turn: ${saveError.message}`);

  return { newState, logEntry };
}

// --- EXPORT 3: RESET ---
export async function resetGame(archetypeKey?: keyof typeof ARCHETYPES) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  return createNewGame({ forceNew: true, archetypeKey });
}
