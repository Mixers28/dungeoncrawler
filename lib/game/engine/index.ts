import { MONSTER_MANUAL, WEAPON_TABLE, STORY_ACTS } from '../../rules';
import { getClassReference } from '../../5e/classes';
import { armorByName, weaponsByName, wizardSpellsByName, clericSpellsByName } from '../../5e/reference';
import { rollLoot } from '../../loot';
import { getSceneById, pickSceneVariant } from '../../story';
import { generateCannedFlavor, type NarrationContext } from '../../narrationEngine';
import { DIFFICULTY_TO_DC, type ClassifiedStunt, type StuntTemplate } from '../../stunts';
import { getNextLevelDef } from '../../progression';
import { armorById, armorByName as equipmentArmorByName, resolveArmorId, resolveWeaponId, weaponsById, weaponsByName as equipmentWeaponsByName } from '../../items';
import { getTraderAtLocation } from '../../traders';
import { rollDice, rollD20 } from '../dice';
import { type CoreActionIntent, type GameIntent, type TradeIntent } from '../intent';
import { type GameState, type LogEntry, type NarrationMode, applySceneEntry, computeArmorClassFromInventory, resolveRoomDescription, resolveSceneImage } from '../state';


// --- HELPERS ---

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

function isShieldName(name: string): boolean {
  return armorByName[name.toLowerCase()]?.category?.toLowerCase() === 'shield';
}

function pickDiceAtLevel(map: Record<string, string> | undefined, level: number): string | null {
  if (!map) return null;
  const levels = Object.keys(map).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (levels.length === 0) return null;
  const chosen = levels.filter(l => l <= level).pop() ?? levels[0];
  return map[String(chosen)] ?? null;
}

function pickDamageDiceFromMechanics(
  mechanics: { damage?: { dice?: string; atSlotLevel?: Record<string, string>; atCharacterLevel?: Record<string, string> }; level?: number },
  characterLevel: number
): string | null {
  if (!mechanics.damage) return null;
  const slotLevel = mechanics.level ?? 1;
  return (
    pickDiceAtLevel(mechanics.damage.atCharacterLevel, characterLevel) ||
    pickDiceAtLevel(mechanics.damage.atSlotLevel, slotLevel) ||
    mechanics.damage.dice ||
    null
  );
}

function pickHealDiceFromMechanics(
  mechanics: { healAtSlotLevel?: Record<string, string>; level?: number }
): string | null {
  if (!mechanics.healAtSlotLevel) return null;
  const slotLevel = mechanics.level ?? 1;
  return pickDiceAtLevel(mechanics.healAtSlotLevel, slotLevel);
}

function awardGold(state: GameState, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return;
  state.gold = Math.max(0, (state.gold || 0) + amount);
}

function applyXpAndCheckLevelUp(state: GameState, xpGained: number, logs: string[], reason?: string) {
  if (!Number.isFinite(xpGained) || xpGained <= 0) return;
  state.xp += xpGained;
  if (reason) {
    logs.push(`You gain ${xpGained} XP ${reason}`);
  } else {
    logs.push(`You gain ${xpGained} XP.`);
  }

  while (true) {
    const next = getNextLevelDef(state.level);
    if (!next) break;
    if (state.xp < next.xpRequired) break;
    state.level = next.level;
    state.maxHp += next.hpGain;
    state.hp = state.maxHp;
    logs.push(`You reach level ${state.level}. Your maximum HP increases to ${state.maxHp}.`);
  }
  const upcoming = getNextLevelDef(state.level);
  if (upcoming) state.xpToNext = upcoming.xpRequired;
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

  const primaryWeapon =
    inventory.find(i => i.type === 'weapon' && i.equipped)?.name ||
    inventory.find(i => i.type === 'weapon')?.name;
  const armor =
    inventory.find(i => i.type === 'armor' && i.equipped && !isShieldName(i.name))?.name ||
    inventory.find(i => i.type === 'armor' && !isShieldName(i.name))?.name;
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

function getEquippedWeaponDamageDice(state: GameState, fallbackName: string): string {
  if (state.equippedWeaponId) {
    const def = weaponsById[state.equippedWeaponId];
    if (def?.damageDice) return def.damageDice;
  }
  const byName = equipmentWeaponsByName[fallbackName.toLowerCase()];
  if (byName?.damageDice) return byName.damageDice;
  return getWeaponDamageDice(fallbackName);
}

function getBaseAcFromEquipped(state: GameState): number {
  if (!state.inventory || state.inventory.length === 0) return state.ac;
  const abilityScores = state.abilityScores || {};
  const computed = computeArmorClassFromInventory(state.inventory, abilityScores);
  return Math.max(state.ac, computed);
}

function resolveTradeIntent(
  state: GameState,
  tradeIntent: TradeIntent
): { eventSummary: string; narrationMode: NarrationMode } {
  const trader = getTraderAtLocation(state.location);
  const narrationMode: NarrationMode = 'GENERAL';

  if (!trader) {
    return { eventSummary: 'There is no trader here to do business with.', narrationMode };
  }

  if (tradeIntent.type === 'openShop') {
    const itemsList = trader.inventory.map(item => `${item.itemId} (${item.price}g)`).join(', ');
    const eventSummary = `You approach ${trader.name}. For sale: ${itemsList}. You have ${state.gold} gold.`;
    return { eventSummary, narrationMode };
  }

  if (tradeIntent.type === 'buy' && tradeIntent.itemName) {
    const itemName = tradeIntent.itemName.trim().toLowerCase();
    const invEntry = trader.inventory.find(item => item.itemId.toLowerCase() === itemName);
    if (!invEntry) {
      const eventSummary = `${trader.name} does not sell ${tradeIntent.itemName}.`;
      return { eventSummary, narrationMode };
    }
    if (state.gold < invEntry.price) {
      const eventSummary = `You cannot afford ${invEntry.itemId} (costs ${invEntry.price} gold, you have ${state.gold}).`;
      return { eventSummary, narrationMode };
    }

    awardGold(state, -invEntry.price);
    const weaponDef = weaponsById[invEntry.itemId] || equipmentWeaponsByName[invEntry.itemId];
    const armorDef = armorById[invEntry.itemId] || equipmentArmorByName[invEntry.itemId];
    const displayName = weaponDef?.name || armorDef?.name || invEntry.itemId.replace(/_/g, ' ');
    const itemType = weaponDef ? 'weapon' : armorDef ? 'armor' : 'potion';
    const existingIdx = state.inventory.findIndex(item => item.name.toLowerCase() === displayName.toLowerCase());
    if (existingIdx >= 0) {
      state.inventory = state.inventory.map((item, idx) =>
        idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      state.inventory = [
        ...state.inventory,
        { id: `shop-${Date.now().toString(36)}`, name: displayName, type: itemType, quantity: 1, equipped: false },
      ];
    }

    if (weaponDef) {
      state.inventory = state.inventory.map(item =>
        item.type === 'weapon' ? { ...item, equipped: item.name.toLowerCase() === displayName.toLowerCase() } : item
      );
      state.equippedWeaponId = resolveWeaponId(displayName);
    }
    if (armorDef) {
      const buyingShield = isShieldName(displayName);
      state.inventory = state.inventory.map(item => {
        if (item.type !== 'armor') return item;
        const itemIsShield = isShieldName(item.name);
        if (buyingShield) {
          return itemIsShield
            ? { ...item, equipped: item.name.toLowerCase() === displayName.toLowerCase() }
            : item;
        }
        return itemIsShield ? item : { ...item, equipped: item.name.toLowerCase() === displayName.toLowerCase() };
      });
      if (!buyingShield) state.equippedArmorId = resolveArmorId(displayName);
      state.ac = Math.max(state.ac, computeArmorClassFromInventory(state.inventory, state.abilityScores || {}));
    }

    const eventSummary = `You buy ${displayName} from ${trader.name} for ${invEntry.price} gold. You now have ${state.gold} gold.`;
    return { eventSummary, narrationMode };
  }

  if (tradeIntent.type === 'sell' && tradeIntent.itemName) {
    const itemName = tradeIntent.itemName.trim().toLowerCase();
    const invIdx = state.inventory.findIndex(item => item.name.toLowerCase() === itemName);
    if (invIdx < 0) {
      const eventSummary = `You do not have ${tradeIntent.itemName} to sell.`;
      return { eventSummary, narrationMode };
    }

    const invItem = state.inventory[invIdx];
    const traderPrice = trader.inventory.find(item => item.itemId.toLowerCase() === itemName)?.price;
    const basePrice = traderPrice ?? 2;
    const sellPrice = Math.max(1, Math.floor(basePrice * trader.buybackRate));
    awardGold(state, sellPrice);
    const remainingQty = Math.max(0, invItem.quantity - 1);
    if (remainingQty === 0) {
      state.inventory = state.inventory.filter((_, idx) => idx !== invIdx);
    } else {
      state.inventory = state.inventory.map((item, idx) =>
        idx === invIdx ? { ...item, quantity: remainingQty } : item
      );
    }
    const eventSummary = `You sell ${invItem.name} for ${sellPrice} gold. You now have ${state.gold} gold.`;
    return { eventSummary, narrationMode };
  }

  return { eventSummary: 'You fail to complete any trade.', narrationMode };
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
  intent: GameIntent
): Promise<{
  newState: GameState;
  roomDesc: string;
  accountantFacts: string[];
  eventSummary: string;
  narrationMode: NarrationMode;
}> {
  const userAction = intent.userAction;
  // 1. DETERMINE PLAYER WEAPON & DAMAGE
  const classKey = (currentState.character?.class || 'fighter').toLowerCase();
  const spellCatalog = classKey === 'cleric' ? clericSpellsByName : wizardSpellsByName;
  const parsedIntent = intent.parsedIntent;
  const actionIntent: CoreActionIntent = intent.actionIntent;

  const preferredWeaponName = parsedIntent.type === 'attack' && parsedIntent.weaponName
    ? parsedIntent.weaponName
    : currentState.inventory.find(i => i.type === 'weapon')?.name;

  let weaponName = preferredWeaponName || "Fists";
  let playerDmgDice = getEquippedWeaponDamageDice(currentState, weaponName);
  const weaponAllowed = isWeaponAllowedForClass(weaponName, classKey);
  if (!weaponAllowed && weaponName !== "Fists") {
    weaponName = "Fists";
    playerDmgDice = getEquippedWeaponDamageDice(currentState, weaponName);
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
  let playerAttackIsSave = false;
  let playerAttackDc: number | null = null;
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

  // Quick-use consumables (bandages, potions)
  const wantsBandage = /bandage/i.test(userAction);
  const wantsPotion = /(potion|elixir|draught|draft)/i.test(userAction);
  const bandageIdx = newState.inventory.findIndex(i => i.name.toLowerCase().includes('bandage') && i.quantity > 0);
  const potionIdx = wantsPotion
    ? newState.inventory.findIndex(i => i.name.toLowerCase().includes('potion') && i.quantity > 0)
    : -1;
  let handledConsumable = false;

  if (wantsPotion) {
    handledConsumable = true;
    if (potionIdx >= 0) {
      const item = newState.inventory[potionIdx];
      const potionName = item.name.toLowerCase();
      let healDice = '2d4+2';
      if (potionName.includes('greater')) healDice = '4d4+4';
      const heal = rollDice(healDice);
      newState.hp = Math.min(newState.maxHp, newState.hp + heal);
      const remainingQty = Math.max(0, item.quantity - 1);
      if (remainingQty <= 0) {
        newState.inventory = newState.inventory.filter((_, idx) => idx !== potionIdx);
      } else {
        newState.inventory = newState.inventory.map((it, idx) => idx === potionIdx ? { ...it, quantity: remainingQty } : it);
      }
      newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Used ${item.name} (${heal} HP) at ${newState.location}`].slice(-10);
      summaryParts.push(`You drink ${item.name}, recovering ${heal} HP.`);
    } else {
      summaryParts.push("You fumble for a potion, but you have none left.");
    }
  } else if (wantsBandage) {
    handledConsumable = true;
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

  if (!handledConsumable) {
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
        const mechanics = spell.mechanics;
        let handledMechanics = false;

        if (mechanics) {
          const healDice = pickHealDiceFromMechanics(mechanics);
          if (healDice) {
            const heal = rollDice(healDice);
            newState.hp = Math.min(newState.maxHp, newState.hp + heal);
            summaryParts.push(`Healing energy restores ${heal} HP.`);
            handledMechanics = true;
          } else if (mechanics.damage) {
            const damageDice = pickDamageDiceFromMechanics(mechanics, newState.level);
            if (damageDice && activeMonster) {
              const damageType = mechanics.damage.type ? mechanics.damage.type.toLowerCase() : 'damage';
              if (mechanics.attackType) {
                const spellAttack = rollD20() + (newState.spellAttackBonus || 0);
                playerAttackRoll = spellAttack;
                playerAttackIsSave = false;
                playerAttackDc = null;
                if (spellAttack >= activeMonster.ac) {
                  const dmg = rollDice(damageDice);
                  playerDamageRoll = dmg;
                  applyDamageToActiveMonster(dmg);
                  summaryParts.push(`You cast ${spell.name} at ${targetName}, dealing ${dmg} ${damageType} damage.`);
                } else {
                  summaryParts.push(`Your ${spell.name} misses ${targetName}.`);
                }
              } else if (mechanics.dc?.ability) {
                const saveRoll = rollD20();
                playerAttackRoll = saveRoll;
                playerAttackIsSave = true;
                playerAttackDc = newState.spellSaveDc || 10;
                if (saveRoll < (newState.spellSaveDc || 10)) {
                  const dmg = rollDice(damageDice);
                  playerDamageRoll = dmg;
                  applyDamageToActiveMonster(dmg);
                  summaryParts.push(`You cast ${spell.name} at ${targetName}, dealing ${dmg} ${damageType} damage.`);
                } else {
                  summaryParts.push(`${targetName} resists your ${spell.name}.`);
                }
              } else {
                const dmg = rollDice(damageDice);
                playerDamageRoll = dmg;
                playerAttackIsSave = false;
                playerAttackDc = null;
                applyDamageToActiveMonster(dmg);
                summaryParts.push(`You cast ${spell.name} at ${targetName}, dealing ${dmg} ${damageType} damage.`);
              }
              handledMechanics = true;
            }
          }
        }

        if (handledMechanics) {
          // Mechanics-driven resolution handled above.
        } else if (lowerSpell === 'magic missile') {
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
    const trader = getTraderAtLocation(newState.location);
    if (trader) {
      summaryParts.push(`A trader is posted here: ${trader.name}.`);
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
    if (intent.tradeIntent) {
      const tradeResult = resolveTradeIntent(newState, intent.tradeIntent);
      stuntModeOverride = tradeResult.narrationMode;
      summaryParts.push(tradeResult.eventSummary);
    } else {
      const stunt = intent.stunt;
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
      const playerAc = getPlayerAc(newState, getBaseAcFromEquipped(newState));
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
      { id: `key-${Date.now().toString(36)}`, name: 'Iron Key', type: 'key', quantity: 1, equipped: false }
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
    applyXpAndCheckLevelUp(newState, xpAward, summaryParts);
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
        applyXpAndCheckLevelUp(
          newState,
          rewardXp,
          summaryParts,
          `for securing ${sceneForReward.title || sceneForReward.location}.`
        );
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
            if (gold > 0) awardGold(newState, gold);
            summaryParts.push(`You recover ${gold ? gold + ' gp' : ''}${gold && (silver || copper) ? ', ' : ''}${silver ? silver + ' sp' : ''}${silver && copper ? ', ' : ''}${(!gold && !silver && copper) ? `${copper} cp` : ''}`.trim().replace(/, $/, ''));
          }
          if (loot.items.length > 0) {
            const newItems = loot.items.map(it => ({
              id: `loot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
              name: it.id.replace(/_/g, ' '),
              type: 'misc' as const,
              quantity: it.quantity,
              equipped: false,
            }));
            newState.inventory = [...newState.inventory, ...newItems];
            newState.inventoryChangeLog = [...newState.inventoryChangeLog, `Scene loot: ${newItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`].slice(-10);
            summaryParts.push(`Loot found: ${newItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}.`);
          }
        }
      }
    }
  }


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
      if (goldFind > 0) awardGold(newState, goldFind);
      if (loot.items.length > 0) {
        for (const it of loot.items) {
          newItems.push({
            id: `loot-${Date.now().toString(36)}`,
            name: it.id.replace(/_/g, ' '),
            type: 'misc',
            quantity: it.quantity,
            equipped: false,
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
        equipped: false,
      });
      awardGold(newState, goldFind);
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
    playerAttackIsSave,
    playerAttackDc: playerAttackDc ?? 0,
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

export async function runGameTurn(
  currentState: GameState,
  intent: GameIntent
): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const { newState, roomDesc, accountantFacts: engineFacts, eventSummary, narrationMode } = await _updateGameState(currentState, intent);

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

  return { newState, logEntry };
}
