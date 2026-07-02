# NOW - Working Memory (WM)

> This file captures the **current focus / sprint**.  
> It should always describe what we're doing *right now*.

<!-- SUMMARY_START -->
**Current Focus (auto-maintained by Agent):**
- Story Phase 1 is fully wired: gate → hub → 3 branches (+ key-gated side rooms) → boss → treasury.
- Next deploy: walk `docs/deploy-checklist.md` end to end on Railway (old saves will need `db:migrate-saves` for `sceneVisits`).
- Next dev work: phased-plan core items (data-driven ability resolution, class proficiency mapping), or story Phase 2 (procedural routes).
<!-- SUMMARY_END -->

---

## Current Objective

Sprint backlog (1–3) and story roadmap Phase 1 are fully shipped. Decide the next track: canonical phased-plan action items (data-driven ability resolution, class proficiency mapping), or story Phase 2 (procedural routes).

---

## Active Branch

- `main` (Sprint 2 merged; `dcv01` work has landed)

---

## What We Are Working On Right Now

- [x] Sprint 3.1 — Automated smoke test: Playwright covering login / start / check skills / attack / loot (`e2e/smoke.spec.ts`, `npm run test:e2e`).
- [x] Sprint 3.2 — Save migration helper: `npm run db:migrate-saves` (dry-run report; `-- --apply` writes back; `-- --user <email>` scopes to one save).
- [x] Sprint 3.3 — Deploy checklist: `docs/deploy-checklist.md` (build, env, DB, login flow, combat/dice, story navigation, persistence).
- [x] Story Phase 1 wiring — Act 1 now runs gate → hub → 3 branches (+ side rooms via discoverable keys) → convergence boss → treasury; validated by full engine traversal.

---

## Next Small Deliverables

- Run `docs/deploy-checklist.md` against the next Railway deploy.
- Fix the two pre-existing `react-hooks/set-state-in-effect` lint errors in `app/page.tsx` (lines ~189, ~231).
- Persist the legacy `mixers28` save cleanup: `npm run db:migrate-saves -- --apply --user mixers28`.

## E2E notes

- `npm run test:e2e` (Playwright) auto-starts `next dev`; needs local Postgres (`docker compose up -d`) and `.env.local` with `DATABASE_URL`.
- The spec signs up a fresh throwaway user (`smoke-<ts>@e2e.test`) each run, so no seeded test user is required.

---

## Notes / Scratchpad

- Story roadmap Phase 1 leftovers (not part of Sprint 3, tracked in `docs/phased-plan.md`): seeded `future_*` variant selection, key/map discovery chances, Act 1 entry wired to the hub scenes.
- No test tooling existed before Sprint 3 — no `test` script in package.json.
