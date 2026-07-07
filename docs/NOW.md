# NOW - Working Memory

> Current focus, build order, and short-term handoff notes. Long-term architecture belongs in `docs/PROJECT_CONTEXT.md`; roadmap detail belongs in `docs/phased-plan.md`.

<!-- SUMMARY_START -->
**Current Focus:**
- Documentation has been unified around Drizzle/Postgres, Auth.js credentials, deterministic server actions, and JSON-driven story/rules data.
- Recent engine fixes added equip/drop commands, owned-weapon validation, equipped-weapon default attacks, matching requested-weapon damage dice, and target-aware attacks.
- Story Phase 1 is closed: authored hub/branch/boss progression now has unit regression coverage for gates, discoveries, branch completion, boss unlocks, and seeded variants.
- Visual Multiplayer Phase 0 is functionally closed: `VisualDungeonShell` runs full-time (exploration + combat) against Codex's `buildVisualGameViewModel`, with button-driven movement/combat/inventory/spellbook drawers, Act 1 manifest coverage/placeholders, and a multiplayer-readiness review.
- Visual Multiplayer Phase M1 has started: `SessionState` and `CharacterState` schemas now exist beside `GameState`, with lossless party-of-one split/compose helpers, `TurnContext` combat target/damage/retaliation helpers, and regression coverage.
- Validation baseline is green: `npm run db:migrate`, `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm run test:e2e` (including new `e2e/visual-mode.spec.ts`) pass locally.
- Next verification gap: walk the deploy checklist against the production environment.
<!-- SUMMARY_END -->

## Active Branch

- `main`

## Current Build Order

1. **Finish docs unification**
   - Update canonical docs and stale setup references.
   - Keep `README.md`, `docs/PROJECT_CONTEXT.md`, `docs/NOW.md`, `docs/phased-plan.md`, `SMOKE.md`, and `docs/deploy-checklist.md` aligned.

2. **Run full local validation**
   - `docker compose up -d`
   - `npm run db:migrate`
   - `npm run test:unit`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   - `npm run test:e2e`

3. **Walk the deploy checklist**
   - Use `docs/deploy-checklist.md`.
   - Confirm Railway env vars, production migrations, login, persistence, combat, story navigation, and logs.

4. **Start Visual Multiplayer Phase M1**
   - Use `docs/visual-multiplayer-phase0.md`.
   - Use `docs/multiplayer-readiness-review.md`.
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
   - [ ] Start the next engine migration slice: casting state access.

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
- Multiplayer readiness review added in `docs/multiplayer-readiness-review.md`; next backend work is Phase M1 state split.
- M1 state split starter slice added: `sessionStateSchema`, `characterStateSchema`, and `splitGameStateForSolo`/`composeGameStateForSolo` with round-trip tests.
- First M1 combat-access slice added: `TurnContext` helpers now own active monster targeting and monster HP/status damage application.
- Solo monster retaliation now reads active monsters and applies actor HP damage through `TurnContext`; session round batching remains a Phase M2 change.

## E2E Notes

- `npm run test:e2e` auto-starts `next dev` through Playwright config.
- It requires local Postgres and `.env.local` with `DATABASE_URL` and `AUTH_SECRET`.
- The smoke spec signs up a fresh throwaway user (`smoke-<ts>@e2e.test`) each run.
- Last successful run: 2026-07-07.

## Scratchpad

- `docs/multiplayer-design.md` is untracked at the time of this note; treat it as user work unless explicitly asked to edit it.
- `docs/visual-multiplayer-phase0.md` is the current UI/asset plan that bridges the existing solo game to the multiplayer design.
- `docs/agent-crossover-contract.md` defines Codex backend ownership, Claude frontend ownership, and reciprocal audits.
- `docs/agent-handoff.md` is the active communication ledger between agents.
- `lib/build-info.ts` is generated by `npm run build`; avoid committing timestamp-only churn unless intentionally updating build metadata.
