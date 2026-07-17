# Multiplayer Readiness Review

Date: 2026-07-07
Status: Phase 0 ready for Phase M1 backend work

## Verdict

Visual Multiplayer Phase 0 is functionally ready for the multiplayer state split.
The current shell and backend view model can represent the UI concepts M1/M2 need:
party slots, turn ownership, disabled actions with reasons, actor-named logs, and
local asset fallbacks.

This does not mean multiplayer sessions exist yet. The next backend build remains
Phase M1 from `docs/multiplayer-design.md`: split `GameState` into shared
session state and per-player character state behind a party-of-one shim.

## Checks

| Requirement | Status | Evidence |
|---|---|---|
| 2-4 party slots | Ready at contract level | `VisualGameViewModel.partySlots` is an array of `VisualPartySlot`; `PartyRail` renders mapped slots. Solo builder currently emits one slot. |
| Turn ownership | Ready at contract level | `VisualTurnState.currentTurnPlayerId`, `canAct`, and `reason` exist and are consumed by the shell. M1 should hydrate these from session turn state. |
| Locked controls | Ready | Movement, combat, inventory, spell, and threat attack actions all carry `enabled` and `reason`. |
| Targeted combat | Ready | `VisualThreatView.attackAction` provides backend-owned target commands and `targetId`. |
| Actor-named logs | Ready for storage and display | `logEntrySchema.actorName` and `VisualLogEntry.actorName` are optional fields. M1 must thread actor names when writing shared logs. |
| Visual asset fallback | Ready | Act 1 story scene IDs resolve through `data/visual/asset-manifest.json`; monsters/items have deterministic placeholder fallbacks. |
| No text required for smoke path | Ready | `e2e/visual-mode.spec.ts` covers visual landmarks, movement, inventory drawer, and spellbook drawer. |

## Phase M1 Entry Criteria

- Keep single-player save loading and e2e behavior unchanged.
- [x] Introduce `SessionState` and `CharacterState` schemas beside the current
  `GameState` schema.
- [x] Add compose/split helpers so a party-of-one can still call the current engine
  while slices are migrated.
- [x] Preserve `buildVisualGameViewModel(state)` for solo until a session-aware
  adapter exists.
- [ ] Add a session-aware view-model adapter only after the state split has stable
  tests.

## Known Follow-Ups

- Generated final art is still polish. The manifest now has deterministic
  coverage and placeholders, but several branch/side-room assets reuse existing
  local art.
- `runGameTurn` still mutates a single `GameState`. M1 should migrate access in
  slices: combat, casting, story/exits, loot/economy, then sheet fields.
- Combat monster turns still retaliate per solo action. M2 should move monster
  behavior to a session round resolver.
- `VisualGameViewModel.mode` is still `'solo'`; add multiplayer mode values when
  the session adapter exists.
