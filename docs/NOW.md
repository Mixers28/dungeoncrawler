# NOW - Working Memory (WM)

> This file captures the **current focus / sprint**.  
> It should always describe what we're doing *right now*.

<!-- SUMMARY_START -->
**Current Focus (auto-maintained by Agent):**
- Sprint 3 (QA + Ops) is complete — smoke test, save migration CLI, deploy checklist all shipped.
- Next deploy: walk `docs/deploy-checklist.md` end to end on Railway.
- Next dev work (pick one): story Phase 1 leftovers, or phased-plan core items (data-driven ability resolution).
<!-- SUMMARY_END -->

---

## Current Objective

Sprint backlog (1–3) is fully shipped. Decide the next track: story roadmap Phase 1 leftovers, or the canonical phased-plan action items (`docs/phased-plan.md`).

---

## Active Branch

- `main` (Sprint 2 merged; `dcv01` work has landed)

---

## What We Are Working On Right Now

- [x] Sprint 3.1 — Automated smoke test: Playwright covering login / start / check skills / attack / loot (`e2e/smoke.spec.ts`, `npm run test:e2e`).
- [x] Sprint 3.2 — Save migration helper: `npm run db:migrate-saves` (dry-run report; `-- --apply` writes back; `-- --user <email>` scopes to one save).
- [x] Sprint 3.3 — Deploy checklist: `docs/deploy-checklist.md` (build, env, DB, login flow, combat/dice, story navigation, persistence).

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
