# NOW - Working Memory (WM)

> This file captures the **current focus / sprint**.  
> It should always describe what we're doing *right now*.

<!-- SUMMARY_START -->
**Current Focus (auto-maintained by Agent):**
- Sprint 3: QA + Ops (see `docs/sprint-backlog.md`).
- Build an automated Playwright smoke test for login/start/core actions.
- Then: save migration helper and deploy checklist.
<!-- SUMMARY_END -->

---

## Current Objective

Sprint 3 (QA + Ops): protect everything Sprint 1–2 shipped with automated smoke coverage, then add save-migration tooling and a deploy checklist.

---

## Active Branch

- `main` (Sprint 2 merged; `dcv01` work has landed)

---

## What We Are Working On Right Now

- [x] Sprint 3.1 — Automated smoke test: Playwright covering login / start / check skills / attack / loot (`e2e/smoke.spec.ts`, `npm run test:e2e`).
- [x] Sprint 3.2 — Save migration helper: `npm run db:migrate-saves` (dry-run report; `-- --apply` writes back; `-- --user <email>` scopes to one save).
- [ ] Sprint 3.3 — Deploy checklist: build, login flow, combat/dice, story navigation.

---

## Next Small Deliverables

- Sprint 3.3: deploy checklist doc (build, login flow, combat/dice, story navigation).

## E2E notes

- `npm run test:e2e` (Playwright) auto-starts `next dev`; needs local Postgres (`docker compose up -d`) and `.env.local` with `DATABASE_URL`.
- The spec signs up a fresh throwaway user (`smoke-<ts>@e2e.test`) each run, so no seeded test user is required.

---

## Notes / Scratchpad

- Story roadmap Phase 1 leftovers (not part of Sprint 3, tracked in `docs/phased-plan.md`): seeded `future_*` variant selection, key/map discovery chances, Act 1 entry wired to the hub scenes.
- No test tooling existed before Sprint 3 — no `test` script in package.json.
