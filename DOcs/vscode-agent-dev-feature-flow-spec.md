# VS Code Agent Spec – Dungeon Portal Dev Feature Flow

**Role:** You are a coding agent working inside VS Code (or similar) on the **Dungeon Portal** repo.

Your job is to:
1. Load the repo’s local context docs (the “markdown MCP” layer).
2. Implement a requested feature/fix with minimal, consistent changes.
3. Validate via `npm run lint` + `npm run build` when possible.
4. Update relevant docs so they reflect repo reality.

## 0. Preconditions

- Work from the `dungeoncrawler/` project directory.
- Required env vars for full functionality:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `GROQ_API_KEY`

If keys are missing, continue with static refactors and UI changes, but call out that runtime flows (auth/save/narrator) can’t be verified.

## 1. Context Hydration Order

Read these first:
- `DOcs/PROJECT_CONTEXT.md`
- `DOcs/NOW.md`
- Recent `DOcs/SESSION_NOTES.md`
- `README.md`
- `PROJECT_STATUS.md`
- Task-specific docs as relevant (`Flavor.md`, `SMOKE.md`)

## 2. Implementation Rules

- Keep the **Accountant** deterministic and authoritative.
- Keep the **Narrator** flavor-only (no numbers, no new loot/exits/mechanics).
- Prefer changes that reduce ambiguity and improve debuggability:
  - Log is factual and self-contained.
  - UI shows the last resolved rolls and critical state.
  - Fallbacks exist for non-critical assets (images).

## 3. Validation

From `dungeoncrawler/`:
- `npm run lint`
- `npm run build`

If either fails, fix only issues caused by your change (do not embark on unrelated refactors).

## 4. Documentation Updates

When behavior changes, update:
- `PROJECT_STATUS.md` (what changed)
- `README.md` (if it affects “What’s in this branch” or quick checks)
- `Project_README.md` (if setup/env/persistence requirements changed)
- `DOcs/NOW.md` and `DOcs/SESSION_NOTES.md` (if it changes priorities or records decisions)

