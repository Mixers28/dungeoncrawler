import { getClassReference } from '../../5e/classes';
import { wizardSpellsByName, clericSpellsByName } from '../../5e/reference';
import { getSceneById, pickSceneVariant } from '../../story';
import { generateCannedFlavor, type NarrationContext } from '../../narrationEngine';
import { getTraderAtLocation } from '../../traders';
import { d20AttackHits, rollCriticalDamage, rollDice, rollD20 } from '../dice';
import { type CoreActionIntent, type GameIntent } from '../intent';
import { type GameState, type LogEntry, type NarrationMode, applySceneEntry, resolveRoomDescription, resolveSceneImage } from '../state';
import { type TurnEvent } from '../../game-schema';
import {
  applyDamageToMonsterTarget,
  appendActorInventoryChange,
  composeGameStateFromTurnContext,
  createTurnContextFromGameState,
  findActiveMonsterTarget,
  incrementSessionSceneVisit,
  removeActorInventoryItemByName,
  syncTurnContextFromGameState,
} from '../turn-context';
import { type RollEvent } from '../../game-schema';


// --- HELPERS ---
export type RunGameTurnOptions = {
  advanceTurnCounter?: boolean;
  suppressMonsterTurn?: boolean;
};

function expireEffects(state: GameState) {
  const turn = state.turnCounter || 0;
  state.activeEffects = (state.activeEffects || []).filter(e => !e.expiresAtTurn || e.expiresAtTurn > turn);
  state.nearbyEntities = (state.nearbyEntities || []).map(ent => ({
    ...ent,
    effects: (ent.effects || []).filter(e => !e.expiresAtTurn || e.expiresAtTurn > turn),
    imageUrl: ent.imageUrl,
    position: ent.position,
  }));
}



import { resolveCorpseLooting } from './loot';
import { resolveMonsterTurn } from './combat';
import { resolveTradeIntent } from './economy';
import { findSceneExitForAction, normalizeLocationKey, resolveBiomeKey } from './movement';
import { resolveStunt } from './stunts';
import { resolveSpellCast } from './spells';
import { resolveConsumableUse } from './consumables';
import {
  dropInventoryItem,
  equipInventoryItem,
  findInventoryItemIndex,
  getEquippedWeaponDamageDice,
  getPlayerAttackBonus,
  describeCharacterSheet,
  summarizeInventory,
} from './sheet';
import { resolveSceneDiscoveries } from './discovery';
import { applySceneCompletion, resolveProgression } from './progression';









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
  return sanitizeForNarrator(text) || "act";
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


function isWeaponAllowedForClass(weaponName: string | undefined, classKey: string): boolean {
  if (!weaponName) return false;
  const ref = getClassReference(classKey);
  return ref.allowedWeapons.map(w => w.toLowerCase()).includes(weaponName.toLowerCase());
}


// --- MAIN LOGIC ENGINE ---
// DM principles: describe what the player perceives, let the player act, resolve fairly.
async function _updateGameState(
  currentState: GameState,
  intent: GameIntent,
  options: RunGameTurnOptions = {}
): Promise<{
  newState: GameState;
  roomDesc: string;
  accountantFacts: string[];
  eventSummary: string;
  narrationMode: NarrationMode;
  rollLog: RollEvent[];
  turnEvents?: TurnEvent[];
}> {
  const userAction = intent.userAction;
  // 1. DETERMINE PLAYER WEAPON & DAMAGE
  const classKey = (currentState.character?.class || 'fighter').toLowerCase();
  const spellCatalog = classKey === 'cleric' ? clericSpellsByName : wizardSpellsByName;
  const parsedIntent = intent.parsedIntent;
  const actionIntent: CoreActionIntent = intent.actionIntent;

  const requestedWeaponName = parsedIntent.type === 'attack' ? parsedIntent.weaponName : undefined;
  const requestedWeaponIdx = requestedWeaponName
    ? findInventoryItemIndex(currentState.inventory, requestedWeaponName, 'weapon')
    : -1;
  const requestedWeaponMissing = !!requestedWeaponName && requestedWeaponIdx < 0;
  const equippedWeapon = currentState.inventory.find(i => i.type === 'weapon' && i.equipped);
  const fallbackWeapon = currentState.inventory.find(i => i.type === 'weapon');
  const preferredWeaponName = requestedWeaponName
    ? currentState.inventory[requestedWeaponIdx]?.name
    : equippedWeapon?.name || fallbackWeapon?.name;

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
  const shouldAdvanceTurnCounter = options.advanceTurnCounter ?? true;
  const shouldResolveMonsterTurn = !(options.suppressMonsterTurn ?? false);
  newState.turnCounter = shouldAdvanceTurnCounter
    ? (currentState.turnCounter || 0) + 1
    : (currentState.turnCounter || 0);
  expireEffects(newState);
  const turnContext = createTurnContextFromGameState(newState);
  const turnEvents: TurnEvent[] = [];

  let currentScene = getSceneById(currentState.storySceneId);
  if (!currentScene && newState.location.toLowerCase().includes('gate')) {
    currentScene = getSceneById('iron_gate_v1') || pickSceneVariant('act1_gate', newState.worldSeed);
  }

  // 2a. Scene exit transitions before other actions
  const sceneExit = findSceneExitForAction(currentScene, userAction);
  if (sceneExit) {
    const aliveThreat = newState.nearbyEntities.some(e => e.status === 'alive');
    if (aliveThreat) {
      newState.lastActionSummary = "You cannot leave while threats remain.";
      return { newState, roomDesc: newState.roomRegistry[newState.location] || "", accountantFacts: ["You cannot leave while threats remain."], eventSummary: newState.lastActionSummary, narrationMode: "GENERAL", rollLog: [] };
    }
    // Leaving a cleared scene counts as completing it: apply onComplete
    // flags/rewards now so exits gated on those flags open immediately.
    const exitSummaries: string[] = [];
    if (currentScene) {
      applySceneCompletion(newState, currentScene, exitSummaries, turnEvents);
    }
    if (sceneExit.consumeItem) {
      const hasItem = newState.inventory.some(i => i.name.toLowerCase() === sceneExit.consumeItem!.toLowerCase());
      if (!hasItem) {
        newState.lastActionSummary = `You need ${sceneExit.consumeItem} to proceed.`;
        return { newState, roomDesc: newState.roomRegistry[newState.location] || "", accountantFacts: [newState.lastActionSummary], eventSummary: newState.lastActionSummary, narrationMode: "GENERAL", rollLog: [], turnEvents };
      }
      // Consumed below, only once the transition actually happens — the target's
      // entryConditions.requiresItem check must still see the item in inventory.
    }
    let target = getSceneById(sceneExit.targetSceneId);
    if (!target && (currentScene?.location.toLowerCase().includes('gate') || currentScene?.id.includes('gate'))) {
      target = pickSceneVariant('act1_courtyard', newState.worldSeed) || getSceneById('courtyard_v1');
    }
    // Deterministic variant selection: exits name a concrete scene id, but the
    // actual variant within its group is picked from the run's worldSeed mixed
    // with a per-group hash, so the choice is stable across revisits within a
    // run while different seeds (and different groups) still vary.
    if (target?.group) {
      const groupHash = target.group.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      target = pickSceneVariant(target.group, newState.worldSeed + groupHash) || target;
    }
    if (target?.entryConditions) {
      const conditions = target.entryConditions;
      let lockedReason: string | null = null;
      if (conditions.minLevel && newState.level < conditions.minLevel) {
        lockedReason = "You are not yet strong enough to proceed here.";
      } else if (conditions.requiresItem && !newState.inventory.some(i => i.name.toLowerCase() === conditions.requiresItem!.toLowerCase())) {
        lockedReason = `You need ${conditions.requiresItem} to proceed.`;
      } else if (conditions.flagsAll && !conditions.flagsAll.every(f => newState.storyFlags.includes(f))) {
        lockedReason = "Something here resists you — you haven't yet done what's needed.";
      } else if (conditions.flagsAny && conditions.flagsAny.length > 0 && !conditions.flagsAny.some(f => newState.storyFlags.includes(f))) {
        lockedReason = "Something here resists you — you haven't yet done what's needed.";
      }
      if (lockedReason) {
        const lockedFacts = [...exitSummaries, lockedReason];
        newState.lastActionSummary = lockedFacts.join(' ');
        return { newState, roomDesc: newState.roomRegistry[newState.location] || "", accountantFacts: lockedFacts, eventSummary: newState.lastActionSummary, narrationMode: "GENERAL", rollLog: [], turnEvents };
      }
    }
    if (target) {
      syncTurnContextFromGameState(turnContext, newState);
      if (sceneExit.consumeItem) {
        newState.inventory = removeActorInventoryItemByName(turnContext, sceneExit.consumeItem);
        newState.inventoryChangeLog = appendActorInventoryChange(turnContext, `Used ${sceneExit.consumeItem}`);
      }
      if (target.group) {
        newState.sceneVisits = incrementSessionSceneVisit(turnContext, target.group);
      }
      const summaryParts: string[] = [...exitSummaries];
      if (sceneExit.log) summaryParts.push(sceneExit.log);
      const { state: transitioned, roomDesc } = applySceneEntry(target.id, newState, summaryParts);
      syncTurnContextFromGameState(turnContext, transitioned);
      const transitionedState = composeGameStateFromTurnContext(turnContext);
      transitionedState.lastActionSummary = summaryParts.join(' ').trim() || `You move to ${target.location}.`;
      return { newState: transitionedState, roomDesc, accountantFacts: summaryParts, eventSummary: transitionedState.lastActionSummary, narrationMode: "ROOM_INTRO", rollLog: [], turnEvents };
    }
  }

  if (requestedWeaponMissing) {
    const missingSummary = `You do not have ${requestedWeaponName} in your pack.`;
    newState.lastActionSummary = missingSummary;
    return {
      newState,
      roomDesc: newState.roomRegistry[newState.location] || "",
      accountantFacts: [missingSummary],
      eventSummary: missingSummary,
      narrationMode: "GENERAL",
      rollLog: [],
    };
  }

  // 3. ACTIVE MONSTER CONTEXT
  const requestedTargetName =
    parsedIntent.type === 'attack' || parsedIntent.type === 'castAbility'
      ? parsedIntent.target
      : undefined;
  const activeMonsterTarget = findActiveMonsterTarget(turnContext, requestedTargetName);
  const activeMonsterIndex = activeMonsterTarget.index;
  const activeMonster = activeMonsterTarget.entity;

  // 4. PLAYER TURN
  let playerAttackRoll = 0;
  let playerDamageRoll = 0;
  let playerAttackIsSave = false;
  let playerAttackDc: number | null = null;
  const summaryParts: string[] = [];
  const rollLog: RollEvent[] = [];
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
    const result = applyDamageToMonsterTarget(turnContext, activeMonsterIndex, damage);
    newState.nearbyEntities = turnContext.session.nearbyEntities;
    combatOutcome = result.status;
  };

  attemptedSearch = wantsSearch;
  attemptedInvestigate = wantsInvestigate;

  // Quick-use consumables and short rest — see engine/consumables.ts
  const consumables = resolveConsumableUse(
    { state: newState, context: turnContext, events: turnEvents, summary: summaryParts, rolls: rollLog },
    { userAction, tradeIntent: intent.tradeIntent, activeMonster, applyDamageToActiveMonster }
  );
  const handledConsumable = consumables.handledConsumable;

  if (!handledConsumable) {
  if (parsedIntent.type === 'equip') {
    summaryParts.push(equipInventoryItem(newState, parsedIntent.itemName));
  } else if (parsedIntent.type === 'drop') {
    summaryParts.push(dropInventoryItem(newState, parsedIntent.itemName));
  } else if (parsedIntent.type === 'castAbility') {
    const cast = resolveSpellCast(
      { state: newState, context: turnContext, events: turnEvents, summary: summaryParts, rolls: rollLog },
      {
        parsedIntent,
        spellCatalog,
        activeMonster,
        activeMonsterIndex,
        applyDamageToActiveMonster,
      }
    );
    playerAttackRoll = cast.playerAttackRoll;
    playerDamageRoll = cast.playerDamageRoll;
    playerAttackIsSave = cast.playerAttackIsSave;
    playerAttackDc = cast.playerAttackDc;
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
    const rawD20 = rollD20();
    const attackBonus = (currentState.character?.attackBonus ?? 0) + getPlayerAttackBonus(newState);
    playerAttackRoll = rawD20 + attackBonus;
    if (d20AttackHits(rawD20, playerAttackRoll, activeMonster.ac)) {
      playerDamageRoll = rawD20 === 20 ? rollCriticalDamage(playerDmgDice) : rollDice(playerDmgDice);
      applyDamageToActiveMonster(playerDamageRoll);
      rollLog.push({ label: 'Your Attack', d20: rawD20, modifier: attackBonus, total: playerAttackRoll, against: activeMonster.ac, outcome: rawD20 === 20 ? 'crit' : 'hit', damage: playerDamageRoll, damageDice: playerDmgDice });
      summaryParts.push(`You hit ${activeMonster.name} with ${weaponName} for ${playerDamageRoll} damage.`);
    } else {
      combatOutcome = 'miss';
      rollLog.push({ label: 'Your Attack', d20: rawD20, modifier: attackBonus, total: playerAttackRoll, against: activeMonster.ac, outcome: 'miss' });
      summaryParts.push(`You miss ${activeMonster.name}.`);
    }
  } else if (actionIntent === 'defend') {
    newState.tempAcBonus = 4;
    summaryParts.push("You brace for impact, raising your guard.");
  } else if (actionIntent === 'run') {
    newState.nearbyEntities = [];
    newState.isCombatActive = false;
    summaryParts.push("You flee the encounter.");
  } else if (parsedIntent.type === 'checkSheet') {
    summaryParts.push(describeCharacterSheet(turnContext));
  } else {
    if (intent.tradeIntent) {
      const tradeResult = resolveTradeIntent(newState, intent.tradeIntent, turnContext);
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

  // 5. MONSTER TURN — see engine/combat.ts
  const monsterTurn = resolveMonsterTurn(
    { state: newState, context: turnContext, events: turnEvents, summary: summaryParts, rolls: rollLog },
    {
      activeMonsterIndex,
      actionIntent,
      shouldResolveMonsterTurn,
      isCastAbility: parsedIntent.type === 'castAbility',
    }
  );
  const monsterAttackRoll = monsterTurn.monsterAttackRoll;
  const monsterDamageRoll = monsterTurn.monsterDamageRoll;

  // 6. CLEANUP COMBAT FLAGS
  newState.tempAcBonus = 0;
  const anyAlive = newState.nearbyEntities.some(e => e.status === 'alive');
  newState.isCombatActive = (anyAlive && (newState.isCombatActive || actionIntent === 'attack' || actionIntent === 'defend')) && newState.hp > 0;
  newState.nearbyEntities = [...newState.nearbyEntities];

  // 6a. SCENE DISCOVERY — see engine/discovery.ts
  const discoveries = resolveSceneDiscoveries(
    { state: newState, context: turnContext, events: turnEvents, summary: summaryParts, rolls: rollLog },
    { userAction, wantsSearch, wantsInvestigate }
  );
  // These flags are only ever raised, never cleared, by this section.
  if (discoveries.attemptedSearch) attemptedSearch = true;
  if (discoveries.foundSearchItems) foundSearchItems = true;

  // 6b. TRACK LOCATION HISTORY
  if (newState.location !== currentState.location) {
    const history = newState.locationHistory || [];
    const updatedHistory = [...history, newState.location].slice(-10);
    newState.locationHistory = updatedHistory;
  }

  // 7. XP, KILLS & STORY ACT PROGRESSION — see engine/progression.ts
  const monsterNow = activeMonsterIndex >= 0 ? newState.nearbyEntities[activeMonsterIndex] : null;
  const monsterKilled = !!(monsterWasAlive && monsterNow && monsterNow.status === 'dead');
  resolveProgression(
    { state: newState, context: turnContext, events: turnEvents, summary: summaryParts, rolls: rollLog },
    { monsterKilled, activeMonsterName: activeMonster?.name }
  );

  // 8b. LOOT CORPSES (simple generic loot) — see engine/loot.ts
  const looting = resolveCorpseLooting(
    { state: newState, context: turnContext, events: turnEvents, summary: summaryParts, rolls: rollLog },
    userAction
  );
  attemptedLoot = looting.attemptedLoot;
  foundLootItems = looting.foundLootItems;

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

  return { newState, roomDesc: finalDesc, accountantFacts: [...summaryParts], eventSummary: newState.lastActionSummary, narrationMode, rollLog, turnEvents };
}

export async function runGameTurn(
  currentState: GameState,
  intent: GameIntent,
  options: RunGameTurnOptions = {}
): Promise<{ newState: GameState; logEntry: LogEntry }> {
  const { newState, roomDesc, accountantFacts: engineFacts, eventSummary, narrationMode, rollLog, turnEvents } = await _updateGameState(currentState, intent, options);

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
    rolls: rollLog.length > 0 ? rollLog : undefined,
    events: turnEvents && turnEvents.length > 0 ? turnEvents : undefined,
  };

  newState.log = [...(newState.log || []), logEntry].slice(-50);
  newState.narrativeHistory = [...newState.narrativeHistory, combinedNarrative].slice(-3);

  return { newState, logEntry };
}
