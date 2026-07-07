import {
  characterStateSchema,
  gameStateSchema,
  sessionStateSchema,
  type CharacterState,
  type GameState,
  type SessionState,
} from '../game-schema';

export const SOLO_PLAYER_ID = 'solo';

export type SoloStateSplit = {
  session: SessionState;
  character: CharacterState;
};

export function splitGameStateForSolo(state: GameState, playerId = SOLO_PLAYER_ID): SoloStateSplit {
  const parsed = gameStateSchema.parse(state);
  const currentTurnPlayerId = parsed.hp > 0 ? playerId : null;

  return {
    session: sessionStateSchema.parse({
      worldSeed: parsed.worldSeed,
      storySceneId: parsed.storySceneId,
      location: parsed.location,
      storyFlags: parsed.storyFlags,
      storyAct: parsed.storyAct,
      currentFloor: parsed.currentFloor,
      sceneVisits: parsed.sceneVisits,
      nearbyEntities: parsed.nearbyEntities,
      isCombatActive: parsed.isCombatActive,
      quests: parsed.quests,
      sceneRegistry: parsed.sceneRegistry,
      roomRegistry: parsed.roomRegistry,
      monsterRegistry: parsed.monsterRegistry,
      locationHistory: parsed.locationHistory,
      currentImage: parsed.currentImage,
      turnCounter: parsed.turnCounter,
      log: parsed.log,
      turnOrder: [playerId],
      currentTurnPlayerId,
      version: 0,
    }),
    character: characterStateSchema.parse({
      playerId,
      userId: null,
      hp: parsed.hp,
      maxHp: parsed.maxHp,
      ac: parsed.ac,
      tempAcBonus: parsed.tempAcBonus,
      gold: parsed.gold,
      level: parsed.level,
      xp: parsed.xp,
      xpToNext: parsed.xpToNext,
      character: parsed.character,
      inventory: parsed.inventory,
      equippedWeaponId: parsed.equippedWeaponId,
      equippedArmorId: parsed.equippedArmorId,
      lastActionSummary: parsed.lastActionSummary,
      narrativeHistory: parsed.narrativeHistory,
      inventoryChangeLog: parsed.inventoryChangeLog,
      lastRolls: parsed.lastRolls,
      abilityScores: parsed.abilityScores,
      skills: parsed.skills,
      knownSpells: parsed.knownSpells,
      preparedSpells: parsed.preparedSpells,
      spellSlots: parsed.spellSlots,
      spellcastingAbility: parsed.spellcastingAbility,
      spellAttackBonus: parsed.spellAttackBonus,
      spellSaveDc: parsed.spellSaveDc,
      activeEffects: parsed.activeEffects,
      totalKills: parsed.totalKills,
    }),
  };
}

export function composeGameStateForSolo(session: SessionState, character: CharacterState): GameState {
  const parsedSession = sessionStateSchema.parse(session);
  const parsedCharacter = characterStateSchema.parse(character);

  return gameStateSchema.parse({
    hp: parsedCharacter.hp,
    maxHp: parsedCharacter.maxHp,
    ac: parsedCharacter.ac,
    tempAcBonus: parsedCharacter.tempAcBonus,
    gold: parsedCharacter.gold,
    level: parsedCharacter.level,
    xp: parsedCharacter.xp,
    xpToNext: parsedCharacter.xpToNext,
    character: parsedCharacter.character,
    location: parsedSession.location,
    inventory: parsedCharacter.inventory,
    equippedWeaponId: parsedCharacter.equippedWeaponId,
    equippedArmorId: parsedCharacter.equippedArmorId,
    quests: parsedSession.quests,
    nearbyEntities: parsedSession.nearbyEntities,
    lastActionSummary: parsedCharacter.lastActionSummary,
    worldSeed: parsedSession.worldSeed,
    narrativeHistory: parsedCharacter.narrativeHistory,
    sceneRegistry: parsedSession.sceneRegistry,
    roomRegistry: parsedSession.roomRegistry,
    monsterRegistry: parsedSession.monsterRegistry,
    storyAct: parsedSession.storyAct,
    currentFloor: parsedSession.currentFloor,
    currentImage: parsedSession.currentImage,
    locationHistory: parsedSession.locationHistory,
    sceneVisits: parsedSession.sceneVisits,
    inventoryChangeLog: parsedCharacter.inventoryChangeLog,
    lastRolls: parsedCharacter.lastRolls,
    isCombatActive: parsedSession.isCombatActive,
    abilityScores: parsedCharacter.abilityScores,
    skills: parsedCharacter.skills,
    knownSpells: parsedCharacter.knownSpells,
    preparedSpells: parsedCharacter.preparedSpells,
    spellSlots: parsedCharacter.spellSlots,
    spellcastingAbility: parsedCharacter.spellcastingAbility,
    spellAttackBonus: parsedCharacter.spellAttackBonus,
    spellSaveDc: parsedCharacter.spellSaveDc,
    activeEffects: parsedCharacter.activeEffects,
    storySceneId: parsedSession.storySceneId,
    storyFlags: parsedSession.storyFlags,
    turnCounter: parsedSession.turnCounter,
    totalKills: parsedCharacter.totalKills,
    log: parsedSession.log,
  });
}
