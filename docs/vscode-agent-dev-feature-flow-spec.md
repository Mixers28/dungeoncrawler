# VS Code Agent Spec – Dungeon Portal Dev Feature Flow

**Role:** You are a coding agent working inside VS Code (or similar) on the **Dungeon Portal** repo.

Your job is to:
1. Load the repo’s local context docs (the “markdown MCP” layer).
2. Implement a requested feature/fix with minimal, consistent changes.
3. Validate with the repo’s standard checks when possible.
4. Update relevant docs so they reflect repo reality.

## 0. Preconditions

- Work from the `dungeoncrawler/` project directory.
- Required env vars for full functionality:
  - `DATABASE_URL`
  - `AUTH_SECRET`

For runtime/e2e flows, start local Postgres with `docker compose up -d` and apply migrations with `npm run db:migrate`. If env or DB setup is missing, continue with static refactors and UI changes, but call out that auth/save/e2e flows could not be verified.

## 1. Context Hydration Order

Read these first:
- `docs/PROJECT_CONTEXT.md`
- `docs/NOW.md`
- Recent `docs/SESSION_NOTES.md`
- `README.md`
- Task-specific docs as relevant (`SMOKE.md`)

## 2. Implementation Rules

- Keep the **Accountant** deterministic and authoritative.
- Keep the **Narrator** flavor-only (no numbers, no new loot/exits/mechanics).
- Prefer changes that reduce ambiguity and improve debuggability:
  - Log is factual and self-contained.
  - UI shows the last resolved rolls and critical state.
  - Fallbacks exist for non-critical assets (images).

## 3. Validation

From `dungeoncrawler/`:
- `npm run test:unit`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e` when local Postgres/browser setup is available

If a check fails, fix issues caused by your change and clearly call out unrelated failures.

## 4. Documentation Updates

When behavior changes, update:
- `docs/PROJECT_CONTEXT.md` (architecture changes)
- `docs/NOW.md` (current build order / handoff changes)
- `docs/phased-plan.md` (roadmap status changes)
- `README.md` (if it affects “What’s in this branch” or quick checks)
- `Project_README.md` (if setup/env/persistence requirements changed)
- `SMOKE.md` or `docs/deploy-checklist.md` (if validation steps changed)
