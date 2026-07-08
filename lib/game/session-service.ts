import { and, eq } from 'drizzle-orm';
import type { db as appDb } from '../db';
import { gameSessions, sessionPlayers } from '../db/schema';
import {
  characterStateSchema,
  sessionStateSchema,
  type CharacterState,
  type GameState,
  type LogEntry,
  type SessionState,
} from '../game-schema';
import { parseIntent } from './intent';
import { runGameTurn } from './engine';
import { rollD20, rollDice } from './dice';
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from './session-code';
import { composeGameStateForSolo, splitGameStateForSolo, splitGameStateForSoloTrusted } from './state-split';

type DbClient = typeof appDb;

export type SessionPlayerSnapshot = {
  userId: string;
  character: CharacterState;
  joinedAt?: Date;
  lastSeenAt?: Date;
};

export type MultiplayerSessionSnapshot = {
  code: string;
  ownerUserId: string;
  session: SessionState;
  you: CharacterState;
  players: SessionPlayerSnapshot[];
  version: number;
  status: string;
};

export type SessionTurnResult = {
  accepted: boolean;
  reason?: string;
  session: SessionState;
  actor: CharacterState;
  players: CharacterState[];
  logEntry: LogEntry;
  logEntries: LogEntry[];
};

const MAX_BALANCED_PARTY_SIZE = 4;

function cloneSessionState(state: SessionState): SessionState {
  return sessionStateSchema.parse(state);
}

function cloneCharacterState(state: CharacterState): CharacterState {
  return characterStateSchema.parse(state);
}

export function generateSessionCode(length = SESSION_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += SESSION_CODE_ALPHABET[Math.floor(Math.random() * SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeSessionTurnState(session: SessionState): SessionState {
  const turnOrder = session.turnOrder.filter((playerId, index, order) =>
    Boolean(playerId) && order.indexOf(playerId) === index
  );
  if (!session.isCombatActive) {
    return {
      ...session,
      turnOrder,
      currentTurnPlayerId: null,
    };
  }

  const currentTurnPlayerId = session.currentTurnPlayerId && turnOrder.includes(session.currentTurnPlayerId)
    ? session.currentTurnPlayerId
    : turnOrder[0] ?? null;

  return {
    ...session,
    turnOrder,
    currentTurnPlayerId,
  };
}

export function createSessionStateForOwner(state: GameState, ownerUserId: string): {
  session: SessionState;
  owner: CharacterState;
} {
  const { session, character } = splitGameStateForSolo(state, ownerUserId);
  return {
    session: normalizeSessionTurnState({
      ...session,
      turnOrder: [ownerUserId],
      version: 0,
    }),
    owner: {
      ...character,
      playerId: ownerUserId,
      userId: ownerUserId,
    },
  };
}

export function createCharacterStateForJoiner(state: GameState, userId: string): CharacterState {
  const { character } = splitGameStateForSolo(state, userId);
  return {
    ...character,
    playerId: userId,
    userId,
  };
}

export function addPlayerToSession(session: SessionState, userId: string): SessionState {
  if (session.isCombatActive) {
    throw new Error('Players can only join while the party is out of combat.');
  }
  if (session.turnOrder.includes(userId)) return normalizeSessionTurnState(session);
  return normalizeSessionTurnState({
    ...session,
    turnOrder: [...session.turnOrder, userId],
  });
}

export function advanceSessionTurn(session: SessionState, actingUserId: string): SessionState {
  if (!session.isCombatActive) {
    return normalizeSessionTurnState(session);
  }

  const turnOrder = session.turnOrder.filter(Boolean);
  if (turnOrder.length === 0) return normalizeSessionTurnState(session);
  const actingIndex = Math.max(0, turnOrder.indexOf(actingUserId));
  const nextIndex = (actingIndex + 1) % turnOrder.length;
  return normalizeSessionTurnState({
    ...session,
    turnOrder,
    currentTurnPlayerId: turnOrder[nextIndex] ?? null,
  });
}

function findNextActivePlayerId(
  session: SessionState,
  players: CharacterState[],
  actingUserId: string
): string | null {
  const alivePlayerIds = new Set(players.filter(player => player.hp > 0).map(player => player.playerId));
  const turnOrder = session.turnOrder.filter(playerId => alivePlayerIds.has(playerId));
  if (turnOrder.length === 0) return null;
  const actingIndex = Math.max(0, turnOrder.indexOf(actingUserId));
  return turnOrder[(actingIndex + 1) % turnOrder.length] ?? turnOrder[0] ?? null;
}

function isLastActivePlayerInRound(
  session: SessionState,
  players: CharacterState[],
  actingUserId: string
): boolean {
  const alivePlayerIds = new Set(players.filter(player => player.hp > 0).map(player => player.playerId));
  const turnOrder = session.turnOrder.filter(playerId => alivePlayerIds.has(playerId));
  if (turnOrder.length === 0) return true;
  return turnOrder[turnOrder.length - 1] === actingUserId;
}

function getEffectiveActorAc(actor: CharacterState): number {
  const effectBonus = Math.max(
    0,
    ...(actor.activeEffects || [])
      .filter(effect => effect.type === 'ac_bonus' && effect.value !== undefined)
      .map(effect => effect.value as number)
  );
  return actor.ac + (actor.tempAcBonus || 0) + effectBonus;
}

function withUpdatedPlayer(players: CharacterState[], updated: CharacterState): CharacterState[] {
  return players.map(player => player.playerId === updated.playerId ? updated : player);
}

export function getPartyMonsterHpScale(partySize: number): number {
  const effectivePartySize = Math.min(MAX_BALANCED_PARTY_SIZE, Math.max(1, Math.floor(partySize)));
  return Math.max(1, 0.75 + (0.25 * effectivePartySize));
}

export function scaleLiveMonstersForParty(session: SessionState, partySize: number): SessionState {
  const scale = getPartyMonsterHpScale(partySize);
  if (scale === 1) return session;

  return {
    ...session,
    nearbyEntities: (session.nearbyEntities || []).map(entity => {
      const isLiveMonster = entity.status === 'alive' && entity.hp > 0;
      if (!isLiveMonster) return entity;
      const scaledMaxHp = Math.max(1, Math.ceil(entity.maxHp * scale));
      const scaledHp = Math.max(1, Math.ceil(entity.hp * scale));
      return {
        ...entity,
        hp: Math.min(scaledHp, scaledMaxHp),
        maxHp: scaledMaxHp,
      };
    }),
  };
}

export function resolveMonsterRound(
  session: SessionState,
  players: CharacterState[]
): { session: SessionState; players: CharacterState[]; logEntries: LogEntry[] } {
  let updatedPlayers = players.map(player => cloneCharacterState(player));
  const logEntries: LogEntry[] = [];
  const aliveMonsters = (session.nearbyEntities || []).filter(entity => entity.status === 'alive' && entity.hp > 0);
  const DISABLING_CONDITIONS = ['mage hand', 'stunned', 'paralyzed', 'held', 'frightened', 'sleep'];

  for (const monster of aliveMonsters) {
    const disablingEffect = (monster.effects || []).find(effect =>
      DISABLING_CONDITIONS.includes(effect.name.toLowerCase())
    );
    if (disablingEffect) {
      logEntries.push({
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        mode: 'GENERAL',
        summary: `${monster.name} is ${disablingEffect.name.toLowerCase()} and cannot attack this round.`,
        actorName: monster.name,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const aliveTargets = updatedPlayers.filter(player => player.hp > 0);
    if (aliveTargets.length === 0) break;
    const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
    const rawMonsterD20 = rollD20();
    const hasBane = (monster.effects || []).some(effect => effect.name.toLowerCase() === 'bane');
    const banePenalty = hasBane ? rollDice('1d4') : 0;
    const monsterBonus = monster.attackBonus - banePenalty;
    const attackTotal = rawMonsterD20 + monsterBonus;
    const targetAc = getEffectiveActorAc(target);
    const baneNote = hasBane ? ` (Bane -${banePenalty})` : '';

    if (attackTotal >= targetAc) {
      const damage = rollDice(monster.damageDice);
      const updatedTarget: CharacterState = {
        ...target,
        hp: Math.max(0, target.hp - damage),
      };
      updatedPlayers = withUpdatedPlayer(updatedPlayers, updatedTarget);
      logEntries.push({
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        mode: 'COMBAT_HIT',
        summary: `${monster.name} hits ${target.character.name} for ${damage} damage.`,
        actorName: monster.name,
        createdAt: new Date().toISOString(),
        rolls: [{
          label: `${monster.name}${baneNote}`,
          d20: rawMonsterD20,
          modifier: monsterBonus,
          total: attackTotal,
          against: targetAc,
          outcome: rawMonsterD20 === 20 ? 'crit' : 'hit',
          damage,
          damageDice: monster.damageDice,
        }],
      });
    } else {
      logEntries.push({
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        mode: 'COMBAT_MISS',
        summary: `${monster.name} misses ${target.character.name}${hasBane ? ', its cursed strike going wide' : ''}.`,
        actorName: monster.name,
        createdAt: new Date().toISOString(),
        rolls: [{
          label: `${monster.name}${baneNote}`,
          d20: rawMonsterD20,
          modifier: monsterBonus,
          total: attackTotal,
          against: targetAc,
          outcome: 'miss',
        }],
      });
    }
  }

  const lastTurnOrderPlayerId = session.turnOrder.length > 0
    ? session.turnOrder[session.turnOrder.length - 1]
    : '';
  const nextSession = normalizeSessionTurnState({
    ...session,
    turnCounter: (session.turnCounter || 0) + 1,
    currentTurnPlayerId: findNextActivePlayerId({ ...session, currentTurnPlayerId: session.turnOrder[0] ?? null }, updatedPlayers, lastTurnOrderPlayerId),
    log: [...(session.log || []), ...logEntries].slice(-50),
  });

  return {
    session: {
      ...nextSession,
      currentTurnPlayerId: nextSession.isCombatActive
        ? nextSession.turnOrder.find(playerId => updatedPlayers.some(player => player.playerId === playerId && player.hp > 0)) ?? null
        : null,
    },
    players: updatedPlayers,
    logEntries,
  };
}

export async function runSessionTurn(
  session: SessionState,
  actor: CharacterState,
  command: string,
  players: CharacterState[] = [actor]
): Promise<SessionTurnResult> {
  const normalizedSession = normalizeSessionTurnState(session);
  const partyPlayers = players.some(player => player.playerId === actor.playerId)
    ? players.map(player => cloneCharacterState(player))
    : [...players.map(player => cloneCharacterState(player)), cloneCharacterState(actor)];
  if (actor.hp <= 0) {
    const blockedSummary = 'You are down and cannot act.';
    return {
      accepted: false,
      reason: blockedSummary,
      session: normalizedSession,
      actor,
      players: partyPlayers,
      logEntry: {
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        mode: 'GENERAL',
        summary: blockedSummary,
        actorName: actor.character.name,
        createdAt: new Date().toISOString(),
      },
      logEntries: [],
    };
  }
  if (
    normalizedSession.isCombatActive &&
    normalizedSession.currentTurnPlayerId &&
    normalizedSession.currentTurnPlayerId !== actor.playerId
  ) {
    const blockedSummary = `It is ${normalizedSession.currentTurnPlayerId}'s turn.`;
    return {
      accepted: false,
      reason: blockedSummary,
      session: normalizedSession,
      actor,
      players: partyPlayers,
      logEntry: {
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        mode: 'GENERAL',
        summary: blockedSummary,
        actorName: actor.character.name,
        createdAt: new Date().toISOString(),
      },
      logEntries: [],
    };
  }

  const composed = composeGameStateForSolo(normalizedSession, actor);
  const intent = parseIntent(command, composed);
  const { newState, logEntry } = await runGameTurn(composed, intent, {
    advanceTurnCounter: !normalizedSession.isCombatActive,
    suppressMonsterTurn: normalizedSession.isCombatActive,
  });
  const actorLogEntry: LogEntry = {
    ...logEntry,
    actorName: actor.character.name,
  };
  const nextState: GameState = {
    ...newState,
    log: [
      ...(newState.log || []).slice(0, -1),
      actorLogEntry,
    ].slice(-50),
  };
  const split = splitGameStateForSoloTrusted(nextState, actor.playerId);
  const rawSessionAfterAction = {
    ...split.session,
    turnOrder: normalizedSession.turnOrder,
    version: normalizedSession.version + 1,
  };
  let nextPlayers = withUpdatedPlayer(partyPlayers, {
    ...split.character,
    playerId: actor.playerId,
    userId: actor.userId,
  });
  const combatStarted = !normalizedSession.isCombatActive && rawSessionAfterAction.isCombatActive;
  const sessionAfterAction = combatStarted
    ? scaleLiveMonstersForParty(rawSessionAfterAction, nextPlayers.length)
    : rawSessionAfterAction;
  let nextSession = sessionAfterAction.isCombatActive
    ? {
        ...sessionAfterAction,
        currentTurnPlayerId: findNextActivePlayerId(sessionAfterAction, nextPlayers, actor.playerId),
      }
    : advanceSessionTurn(sessionAfterAction, actor.playerId);
  const logEntries = [actorLogEntry];

  if (sessionAfterAction.isCombatActive && isLastActivePlayerInRound(sessionAfterAction, nextPlayers, actor.playerId)) {
    const monsterRound = resolveMonsterRound(nextSession, nextPlayers);
    nextSession = {
      ...monsterRound.session,
      version: sessionAfterAction.version,
    };
    nextPlayers = monsterRound.players;
    logEntries.push(...monsterRound.logEntries);
  }

  return {
    accepted: true,
    session: nextSession,
    actor: nextPlayers.find(player => player.playerId === actor.playerId) || {
      ...split.character,
      playerId: actor.playerId,
      userId: actor.userId,
    },
    players: nextPlayers,
    logEntry: actorLogEntry,
    logEntries,
  };
}

async function allocateSessionCode(db: DbClient): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const code = generateSessionCode();
    const existing = await db.select({ id: gameSessions.id }).from(gameSessions).where(eq(gameSessions.id, code)).limit(1);
    if (!existing[0]) return code;
  }
  throw new Error('Could not allocate a session code.');
}

export async function createMultiplayerSession(
  db: DbClient,
  ownerUserId: string,
  initialState: GameState
): Promise<MultiplayerSessionSnapshot> {
  const code = await allocateSessionCode(db);
  const { session, owner } = createSessionStateForOwner(initialState, ownerUserId);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(gameSessions).values({
      id: code,
      ownerUserId,
      sessionState: session as unknown as Record<string, unknown>,
      version: session.version,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(sessionPlayers).values({
      sessionId: code,
      userId: ownerUserId,
      characterState: owner as unknown as Record<string, unknown>,
      joinedAt: now,
      lastSeenAt: now,
    });
  });

  return {
    code,
    ownerUserId,
    session: cloneSessionState(session),
    you: cloneCharacterState(owner),
    players: [{ userId: ownerUserId, character: cloneCharacterState(owner), joinedAt: now, lastSeenAt: now }],
    version: session.version,
    status: 'active',
  };
}

export async function loadMultiplayerSession(
  db: DbClient,
  code: string,
  userId: string
): Promise<MultiplayerSessionSnapshot | null> {
  const normalizedCode = code.trim().toUpperCase();
  const [sessionRow] = await db.select().from(gameSessions).where(eq(gameSessions.id, normalizedCode)).limit(1);
  if (!sessionRow) return null;
  const playerRows = await db.select().from(sessionPlayers).where(eq(sessionPlayers.sessionId, normalizedCode));
  const youRow = playerRows.find(row => row.userId === userId);
  if (!youRow) return null;

  const players = playerRows.map(row => ({
    userId: row.userId,
    character: characterStateSchema.parse(row.characterState),
    joinedAt: row.joinedAt,
    lastSeenAt: row.lastSeenAt,
  }));

  return {
    code: normalizedCode,
    ownerUserId: sessionRow.ownerUserId,
    session: sessionStateSchema.parse(sessionRow.sessionState),
    you: characterStateSchema.parse(youRow.characterState),
    players,
    version: sessionRow.version,
    status: sessionRow.status,
  };
}

export async function joinMultiplayerSession(
  db: DbClient,
  code: string,
  userId: string,
  characterState: CharacterState
): Promise<MultiplayerSessionSnapshot> {
  const normalizedCode = code.trim().toUpperCase();
  const now = new Date();

  await db.transaction(async (tx) => {
    const [sessionRow] = await tx.select().from(gameSessions).where(eq(gameSessions.id, normalizedCode)).limit(1);
    if (!sessionRow) throw new Error('Session not found.');
    if (sessionRow.status !== 'active') throw new Error('Session is not active.');
    const session = sessionStateSchema.parse(sessionRow.sessionState);
    if (session.isCombatActive) throw new Error('Players can only join while the party is out of combat.');

    const existing = await tx.select().from(sessionPlayers).where(
      and(eq(sessionPlayers.sessionId, normalizedCode), eq(sessionPlayers.userId, userId))
    ).limit(1);
    if (!existing[0]) {
      const updatedSession = addPlayerToSession(session, userId);
      await tx.insert(sessionPlayers).values({
        sessionId: normalizedCode,
        userId,
        characterState: characterState as unknown as Record<string, unknown>,
        joinedAt: now,
        lastSeenAt: now,
      });
      await tx.update(gameSessions)
        .set({
          sessionState: updatedSession as unknown as Record<string, unknown>,
          version: sessionRow.version + 1,
          updatedAt: now,
        })
        .where(and(eq(gameSessions.id, normalizedCode), eq(gameSessions.version, sessionRow.version)));
    } else {
      await tx.update(sessionPlayers)
        .set({ lastSeenAt: now })
        .where(and(eq(sessionPlayers.sessionId, normalizedCode), eq(sessionPlayers.userId, userId)));
    }
  });

  const snapshot = await loadMultiplayerSession(db, normalizedCode, userId);
  if (!snapshot) throw new Error('Failed to load joined session.');
  return snapshot;
}

export async function processMultiplayerSessionTurn(
  db: DbClient,
  code: string,
  userId: string,
  command: string
): Promise<SessionTurnResult> {
  const normalizedCode = code.trim().toUpperCase();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [sessionRow] = await tx.select().from(gameSessions).where(eq(gameSessions.id, normalizedCode)).limit(1);
    if (!sessionRow) throw new Error('Session not found.');
    const playerRows = await tx.select().from(sessionPlayers).where(eq(sessionPlayers.sessionId, normalizedCode));
    const playerRow = playerRows.find(row => row.userId === userId);
    if (!playerRow) throw new Error('You are not in this session.');

    const session = sessionStateSchema.parse(sessionRow.sessionState);
    const actor = characterStateSchema.parse(playerRow.characterState);
    const players = playerRows.map(row => characterStateSchema.parse(row.characterState));
    const result = await runSessionTurn(session, actor, command, players);

    if (!result.accepted) return result;

    await tx.update(gameSessions)
      .set({
        sessionState: result.session as unknown as Record<string, unknown>,
        version: sessionRow.version + 1,
        updatedAt: now,
      })
      .where(and(eq(gameSessions.id, normalizedCode), eq(gameSessions.version, sessionRow.version)));
    for (const player of result.players) {
      await tx.update(sessionPlayers)
        .set(player.playerId === userId
          ? {
              characterState: player as unknown as Record<string, unknown>,
              lastSeenAt: now,
            }
          : {
              characterState: player as unknown as Record<string, unknown>,
            })
        .where(and(eq(sessionPlayers.sessionId, normalizedCode), eq(sessionPlayers.userId, player.playerId)));
    }

    return result;
  });
}
