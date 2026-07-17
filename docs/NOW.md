# NOW - Working Memory

> Current focus, build order, and short-term handoff notes. Long-term architecture belongs in `docs/PROJECT_CONTEXT.md`; roadmap detail belongs in `docs/phased-plan.md`.

<!-- SUMMARY_START -->
**Current Focus:**
- Documentation has been unified around Drizzle/Postgres, Auth.js credentials, deterministic server actions, and JSON-driven story/rules data.
- Recent engine fixes added equip/drop commands, owned-weapon validation, equipped-weapon default attacks, matching requested-weapon damage dice, and target-aware attacks.
- Story Phase 1 is closed: authored hub/branch/boss progression now has unit regression coverage for gates, discoveries, branch completion, boss unlocks, and seeded variants.
- Visual Multiplayer Phase 0 is functionally closed: `VisualDungeonShell` runs full-time (exploration + combat) against Codex's `buildVisualGameViewModel`, with button-driven movement/combat/inventory/spellbook drawers, Act 1 manifest coverage/placeholders, and a multiplayer-readiness review.
- Visual Multiplayer Phase M1 and M2 are functionally complete for the local baseline; Phase M3 has started with session-only monster HP scaling for 2-4 player parties.
- Visual interaction/spellbook/corpse-loot stabilization is implemented: Interact resolves obvious scene exits, the wizard visual spellbook matches known/prepared/cantrip spell state, dead monsters remain as visual lootable corpse standees, targeted corpse looting works, and larger monster standees/dead-state monster assets are wired through the manifest.
- Current validation baseline is green for the latest pass: `npm run db:migrate`, `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, and `npx playwright test e2e/visual-mode.spec.ts` pass locally.
- Next verification gap: review the current visual asset/UI batch in a normal browser, then add fuller M3 e2e coverage for multiplayer combat -> corpse loot -> scene transition.
<!-- SUMMARY_END -->

## Active Branch

- `main`

## Current Build Order

1. **Review current visual asset/UI batch**
   - Check larger live monsters, dead monster derivatives, corpse loot controls, and spellbook states in a normal browser.
   - Confirm current generated assets are ready to keep before committing or asking another agent for visual polish.

2. **Add fuller M3 visual e2e coverage**
   - Cover multiplayer combat leading to a dead monster.
   - Verify visual corpse loot after combat.
   - Verify the subsequent scene transition still works.

3. **Run full local validation before handoff/commit**
   - `docker compose up -d`
   - `npm run db:migrate`
   - `npm run test:unit`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   - `npm run test:e2e`

4. **Walk the deploy checklist**
   - Use `docs/deploy-checklist.md`.
   - Confirm Railway env vars, production migrations, login, persistence, combat, story navigation, and logs.

5. **Continue Visual Multiplayer Phase M3**
   - Use `docs/visual-multiplayer-phase0.md`.
   - Use `docs/multiplayer-design.md`.
   - [x] Add asset manifest types and loader helpers.
   - [x] Build a single-player visual shell on current `GameState`.
   - [x] Move movement/actions/inventory/spellbook/log into a compact first-person layout with drawers.
   - [x] Seed Act 1 manifest coverage and deterministic monster/item fallbacks.
   - [x] Add visual-mode smoke coverage (`e2e/visual-mode.spec.ts`).
   - [x] Multiplayer readiness review before starting Phase M1.
   - [x] Add `SessionState` and `CharacterState` schemas beside current `GameState`.
   - [x] Add party-of-one compose/split helpers for the current engine.
   - [x] Add regression coverage proving solo split/compose round-trips without changing saves.
   - [x] Begin engine migration slices: active monster target selection and damage now route through `TurnContext`.
   - [x] Move solo monster retaliation actor-damage reads/writes behind `TurnContext`.
   - [x] Route casting spell-slot, healing, self-effect, and enemy-effect writes through `TurnContext`.
   - [x] Route successful story exit item consumption, inventory logs, scene visits, and transition composition through `TurnContext`.
   - [x] Route search/discovery item grants, inventory logs, and story flags through `TurnContext`.
   - [x] Start the next engine migration slice: loot/economy state access.
   - [x] Start the next engine migration slice: sheet fields.
   - [x] Review Phase M1 context parse/sync costs before Phase M2 session tables.
   - [x] Start Phase M2 session tables and join-by-code flow.
   - [x] Add session-aware party view-model adapter.
   - [x] Add session-aware UI/polling.
   - [x] Move monster turns to a session round-batch resolver.
   - [x] Add two-browser multiplayer e2e coverage.
   - [x] Start Phase M3 balance knobs with party-size monster HP scaling for multiplayer sessions.

## Recently Completed

- Initial Drizzle migration generated for `users` and `saved_games`.
- Supabase migrations marked as legacy historical SQL.
- `next/font/google` removed; app uses a system font stack.
- React lint issues in `app/page.tsx` fixed by deriving spell-slot display during render and deferring localStorage preference sync.
- Unit regression script added: `npm run test:unit`.
- Story Phase 1 authored branching flow closed with regression coverage.
- Local Drizzle migration metadata repaired after the schema existed with an empty `drizzle.__drizzle_migrations` table.
- Visual Multiplayer Phase 0 plan added as the prerequisite for multiplayer implementation.
- Codex/Claude ownership and handoff docs added for split backend/frontend work.
- Visual backend contract added: asset manifest helpers and `buildVisualGameViewModel(state)` for Claude's shell.
- `VisualDungeonShell` built and wired to the real view model: party rail, viewport, movement cluster, action tray, compact log, and inventory/spellbook drawers. Visual mode now runs full-time (exploration + combat), replacing the old combat-only overlay.
- Per-threat attack targeting closed the loop: Codex added `VisualThreatView.attackAction`, Claude Code updated `DungeonViewport` to consume it instead of sanitizing monster names client-side.
- `e2e/visual-mode.spec.ts` added: shell landmarks, movement dispatch, inventory drawer quick-use, spellbook drawer cast — all button-driven, zero free-text.
- Act 1 visual manifest coverage expanded across the Phase 1 story graph; monster and item placeholders added under `public/visual/**`.
- Multiplayer readiness review added and later archived at `docs/archive/planning/multiplayer-readiness-review.md`; Phase M1/M2 are now complete for the local baseline.
- M1 state split starter slice added: `sessionStateSchema`, `characterStateSchema`, and `splitGameStateForSolo`/`composeGameStateForSolo` with round-trip tests.
- First M1 combat-access slice added: `TurnContext` helpers now own active monster targeting and monster HP/status damage application.
- Solo monster retaliation now reads active monsters and applies actor HP damage through `TurnContext`; session round batching remains a Phase M2 change.
- Casting state access now routes spell slots, healing, self effects, minimum AC, and enemy effects through `TurnContext`.
- Successful story exits now consume required items, append inventory change logs, increment scene visits, and compose transitioned state through `TurnContext`.
- Search/discovery now grants discovered items, appends inventory logs, and sets discovery flags through `TurnContext`.
- Loot/economy state access started: trader buy/sell and corpse looting now mutate actor/session fields through `TurnContext`.
- Sheet field access now reads class, skills, gear, spell lists, and slots through a `TurnContext` actor sheet snapshot.
- Phase M1 parse/sync review closed: initial `TurnContext` creation still validates the hydrated `GameState`, while in-turn resyncs now use a trusted split helper that avoids repeated full-state Zod parses.
- Phase M2 server foundation started: Drizzle tables/migration for `game_sessions` and `session_players`, authenticated server actions for create/join/load/session turns, and pure session-service regression coverage for join and turn-gate behavior.
- Session-aware visual view-model adapter added for multiplayer party slots, active-turn indicators, disabled controls, and actor-named shared logs.
- Session-aware UI/polling added: create/join controls, multiplayer command routing, 3-second session polling, disabled turn controls, and e2e coverage for creating a party from visual mode.
- Multiplayer monster turns now resolve as a session round batch after the last active player acts; solo retaliation remains unchanged.
- Two-browser multiplayer e2e now covers owner signup/create party, joiner signup/join by code, polling to 2-player party state, shared movement, and shared log update.
- Phase M3 balance knobs started: newly spawned live monsters in multiplayer sessions scale HP by party size (1.25x for 2 players, 1.5x for 3, 1.75x for 4+) while solo remains unchanged.
- Antigravity (AGY) has been assigned visual asset generation/rework. Codex reviews manifest/schema/path compatibility; Claude Code reviews viewport/UI fit and style consistency. Asset generation is not complete yet; untracked scene PNGs exist under `public/visual/scenes/` but are not wired through the manifest.
- Codex added the controlled OpenAI candidate-generation pipeline: `npm run assets:generate` writes dry-run/API candidates under ignored `public/visual/_candidates/` and never updates the manifest automatically.
- Visual interaction/spellbook/corpse-loot stabilization completed: obvious scene exits now work from visual Interact, the wizard spellbook lists known/prepared/cantrip spell states, dead monsters render as lootable corpse standees, named corpse looting works, larger live monster standees are in place, and generated dead-state monster derivatives are wired through the visual manifest.

## E2E Notes

- `npm run test:e2e` auto-starts `next dev` through Playwright config.
- It requires local Postgres and `.env.local` with `DATABASE_URL` and `AUTH_SECRET`.
- The smoke spec signs up a fresh throwaway user (`smoke-<ts>@e2e.test`) each run.
- Last successful focused visual run: 2026-07-09, `npx playwright test e2e/visual-mode.spec.ts` passed 4/4.

## Scratchpad

- `docs/multiplayer-design.md` remains the architecture reference for session/co-op state.
- `docs/visual-multiplayer-phase0.md` remains the current UI/asset plan that bridges the solo game to multiplayer visual play.
- `docs/agent-crossover-contract.md` defines Codex backend ownership, Claude frontend ownership, Antigravity asset-generation ownership, and reciprocal audits.
- `docs/agent-handoff.md` is the active communication ledger between agents.
- `lib/build-info.ts` is generated by `npm run build`; avoid committing timestamp-only churn unless intentionally updating build metadata.
