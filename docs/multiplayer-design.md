---
name: multiplayer-design
description: Design for co-op multiplayer sessions — state split, session model, turn arbitration, sync
---

# Multiplayer Design (Co-op Sessions)

> Status: design only, not scheduled. Written 2026-07-02 against the state of `main`
> at that date (post story-Phase-1 wiring, data-driven abilities, classes.json).

## Goal and non-goals

**Goal:** 2–4 players run one dungeon together. Shared scenes, shared monsters,
shared story flags; each player has their own character, inventory, and spells.

**Non-goals (first version):** PvP, party splitting across scenes, realtime
movement, spectating strangers, matchmaking. Single-player must keep working
unchanged throughout.

**Recommended first target: async co-op** (play-by-post pacing — players act on
their turn whenever they're online). It needs everything below *except*
presence/timeout handling, and matches the game's turn-based pacing. Live-ish
co-op then becomes a polling-frequency and UI upgrade, not a new system.

## Why this is feasible

- The engine is already server-authoritative and deterministic: every turn runs
  `runGameTurn` in a server action against Postgres. No client game logic.
- Turn-based pacing means polling (2–3s) is an acceptable transport. No
  websockets required for v1.
- `LogEntry.summary` is a neutral fact record — already the right shape for a
  shared party log.
- `db:migrate-saves` + Zod hydration give us a tested path for the schema split.

## The core refactor: splitting GameState

Today `GameState` conflates world and character. The split, field by field:

### → `SessionState` (one per party, the shared world)

| Field | Notes |
|---|---|
| `worldSeed` | drives variant selection for the whole party |
| `storySceneId`, `location` | party moves together (design rule) |
| `storyFlags`, `storyAct`, `currentFloor` | shared progression |
| `sceneVisits` | shared visit tracking |
| `nearbyEntities` | the monsters are shared; entity effects stay on entities |
| `isCombatActive` | derived from `nearbyEntities`; per-session |
| `quests` | shared party quests (v1: one quest log per session) |
| `sceneRegistry`, `roomRegistry`, `monsterRegistry` | image/description caches |
| `locationHistory`, `currentImage` | shared scene presentation |
| `turnCounter` | becomes the **round counter**; see turn model |
| `log` | the shared party log (entries gain an `actorName`) |
| *new* `turnOrder: string[]` | player ids in initiative order |
| *new* `currentTurnPlayerId: string \| null` | null = exploration (free-form) |
| *new* `version: number` | optimistic-lock counter |

### → `CharacterState` (one per player per session)

| Field | Notes |
|---|---|
| `character`, `abilityScores`, `skills`, `level`, `xp`, `xpToNext` | as today |
| `hp`, `maxHp`, `ac`, `tempAcBonus` | per player |
| `inventory`, `equippedWeaponId`, `equippedArmorId`, `gold` | per player (no shared stash in v1) |
| `knownSpells`, `preparedSpells`, `spellSlots`, `spellcastingAbility`, `spellAttackBonus`, `spellSaveDc` | per player |
| `activeEffects` | per player — note `expiresAtTurn` compares against the session round counter |
| `totalKills`, `inventoryChangeLog`, `lastRolls`, `lastActionSummary` | per player (UI conveniences) |

### Dropped / absorbed

- `narrativeHistory` — legacy, already superseded by `log`.

### Compatibility strategy

Keep `gameStateSchema` as-is for single-player saves. Define `sessionStateSchema`
and `characterStateSchema` as the new source of truth, then express the legacy
`GameState` as `SessionState + CharacterState` composed for a party of one:

```ts
// engine signature after the split
runGameTurn(session: SessionState, actor: CharacterState, intent: GameIntent)
  => { session, actor, logEntry }
```

Single-player load path: hydrate legacy blob → split into (session, character) →
run → recompose for saving. Once stable, migrate `saved_games` rows to the split
shape with `db:migrate-saves` and drop the composition shim.

**Engine mechanics:** `_updateGameState` reads/writes `newState.X` throughout.
The refactor is mechanical but wide: introduce a `TurnContext { session, actor }`
and move field access onto it. Do it in slices (combat → casting → story/exits →
loot/economy → sheet), keeping the full harness suite green after each slice
(cast harness, Act 1 traversal, e2e smoke).

## Session model (DB)

```sql
sessions (
  id            text primary key,          -- short join code, e.g. 6 chars
  owner_user_id text references users(id),
  session_state jsonb not null,            -- SessionState
  version       integer not null default 0,
  created_at    timestamptz, updated_at timestamptz
)

session_players (
  session_id      text references sessions(id) on delete cascade,
  user_id         text references users(id) on delete cascade,
  character_state jsonb not null,          -- CharacterState
  joined_at       timestamptz,
  last_seen_at    timestamptz,             -- presence, later
  primary key (session_id, user_id)
)
```

Join flow: owner creates session (picks scene = fresh run), shares the code;
joiners pick an archetype and are inserted into `session_players` and appended
to `turnOrder`. Joining mid-run is allowed only while the party is out of combat.

## Turn model

Two modes, switched by `isCombatActive`:

- **Exploration (free-form):** any player may act at any time. Actions are
  serialized by the lock (below) but there is no turn order. Scene exits are a
  party action: moving requires no alive threats (already enforced) and moves
  everyone; v1 rule — any player can trigger the exit.
- **Combat (round-based):** on combat start, `turnOrder` = players in join
  order (initiative rolls later), `currentTurnPlayerId` = first. Each player
  gets one action; after the last player acts, **monsters act once** as a batch
  and the round counter increments. This moves today's monster-retaliation code
  out of the per-action path into a `resolveMonsterRound(session, players)` —
  monsters pick targets (v1: random alive player; aggro later).
- Effect durations (`expiresAtTurn`) key off the round counter — semantics
  roughly match today's turn counter in solo play.
- Idle players: async co-op simply waits. Live co-op later adds a skip timer
  (e.g. 60s) — deliberately out of v1.
- Death: at 0 HP a player spectates; combat continues. Party wipe ends the run.
  Any cleared-room revival mechanic (Spare the Dying exists in data) is post-v1.

## Action pipeline and concurrency

Server action `processSessionTurn(sessionCode, command)`:

1. `BEGIN`; `SELECT ... FOR UPDATE` the session row (serializes all writers).
2. Validate: user is in the session; if combat, it's their turn.
3. Load actor's `character_state`; run `runGameTurn(session, actor, intent)`.
4. If combat and actor was last in the round: `resolveMonsterRound`.
5. Write session (version+1) + all touched character rows; `COMMIT`.
6. Return `{ session, you, logEntries }`.

Rejections (not your turn, stale version) return a friendly "It's Ana's turn"
summary rather than an error.

## Sync (v1: polling)

- Client polls `getSessionState(sessionCode, sinceVersion)` every 2–3s; server
  returns `304`-equivalent (`{ upToDate: true }`) unless `version` advanced —
  cheap on Railway/Postgres.
- New log entries since the client's last seen version render as normal chat
  bubbles with the actor's name.
- Upgrade path later: Supabase Realtime or SSE keyed on the session row; the
  polling endpoint stays as fallback.

## Log and narration changes

- `logEntrySchema` gains `actorName?: string`; summaries about other players
  render third-person from facts the engine already has ("Ana hits Skeleton
  with Mace for 5 damage") — the Accountant just needs the actor name threaded
  through instead of hardcoded "You".
- Canned flavor stays; it is per-event, not per-viewer.

## Balance (v1 knobs only)

- Monster count/HP scale: multiply spawn HP by `0.75 + 0.25 × partySize`
  (data-driven later via `spawn.scaling` in story JSON).
- XP: full scene XP to each player (keeps solo/party leveling comparable);
  kill XP to the killer. Revisit if it distorts.
- Loot: rolled once, awarded to the acting player; party trade already has a
  natural home in the existing trade intents (post-v1).

## UI (M3)

- Party panel in the left sidebar: name, class, HP bar, turn indicator.
- "It's your turn" affordance + disabled ACT input when it isn't (combat only).
- Join screen: enter code / create session, then the existing archetype picker.
- Dice tray shows your rolls; party rolls appear inline in the log.

## Phasing

| Phase | Deliverable | Exit criteria |
|---|---|---|
| M1 | GameState split behind a party-of-one shim; saves migrated | all harnesses + e2e green; solo play byte-compatible summaries |
| M2 | Session tables, join-by-code, turn gate, polling sync | two browsers complete a fight and a scene transition together |
| M3 | Party UI, actor-named logs, balance knobs | playtest: 2-player run through Act 1 hub → boss |

Effort in recent sprint units: M1 ≈ 1–2 sprints (the hard one), M2 ≈ 1, M3 ≈ 1.

## Risks

- **M1 regressions** — widest-touch refactor since dcv01; mitigate with the
  harnesses and slice-by-slice migration.
- **Log growth** — shared log grows ~partySize× faster; cap stored entries
  (already sliced to 10 in places) and paginate history later.
- **Rules ambiguity** — every "can the party split / trade / revive?" answer
  defaults to *no* in v1; write exceptions here before implementing them.

## Open questions

- Initiative: join order (v1) vs DEX-based rolls — cosmetic until monsters
  target by threat.
- Should exploration actions (search/loot) be once-per-scene-per-party or
  per-player? v1: per-party (first finder gets it), matching current story
  discovery flags.
- Session lifetime: abandon after N days idle? Owner-only delete?
