---
name: enforce-dungeoncrawler-uniformity
description: Enforce Dungeon Portal roadmap scope, code architecture, file health, and visual/UI design consistency through clean-context multi-agent implementation and independent review loops. Use for Dungeon Portal feature work, refactors, UI changes, roadmap-phase execution, consistency audits, or requests to implement and review changes until no findings remain.
---

# Enforce Dungeon Portal Uniformity

Keep every change inside Dungeon Portal's active roadmap phase and make code,
UI, tests, and documentation agree. Coordinate fresh agents for scope, planning,
implementation, verification, and independent code/frontend review. Continue the
fix/review loop until all engineering gates are clear on one frozen revision.

## Preconditions

1. Work only from the dungeoncrawler repository root
   (`dungeoncrawler/`, where `package.json` lives). Confirm these files exist:
   `docs/PROJECT_CONTEXT.md`, `docs/NOW.md`, `docs/phased-plan.md`,
   `docs/DM-rules.md`, and `docs/agent-handoff.md`.
2. Require subagent support. If fresh agents cannot be started, do not imply
   that a self-review is independent; report the workflow as blocked.
3. Read this file and [references/review-loop.md](references/review-loop.md)
   completely before delegating work.
4. Inspect `git status --short` before edits. Preserve unrelated and
   pre-existing changes. Never clean the worktree to simplify review.
5. Before any writer starts, create a content-addressed baseline outside the
   repository. Use a unique non-existing path:

   ```bash
   node .claude/skills/enforce-dungeoncrawler-uniformity/scripts/revision-snapshot.mjs snapshot /tmp/<task>-baseline
   ```

   This is mandatory even when the repository has no commits or all files are
   untracked.
6. Use one writer at a time. Scope, planning, review, and verification agents
   are read-only. Only the implementer or current fixer may edit.

## Intelligence tooling (Repowise and Context7)

Use these throughout every phase; they are pre-edit accelerators, never a
substitute for the raw Read that Claude Code requires before an Edit.

- **Repowise** (MCP tools when connected, otherwise the `repowise` CLI):
  - Locate/understand before editing: `get_answer` / `search_codebase` /
    `get_context` (MCP) or `repowise ask` / `repowise search` (CLI).
  - Risk-gate hotspots before assigning them to a writer: `get_risk` /
    `get_change_risk`. Known bug magnets: `lib/game/engine/index.ts`,
    `lib/game/state.ts`, `app/page.tsx`, `lib/game-schema.ts`, `app/actions.ts`.
  - Self-check touched files before handoff: `get_health`; cleanup sweeps use
    `get_dead_code`.
  - Wrap noisy verification commands with `repowise distill <cmd>` (exit code
    preserved, errors-first); recover omitted output with
    `repowise expand <ref>`, never by re-running.
  - Honor the trust protocol in `.claude/CLAUDE.md`: `verified: true` content
    is live source; do not re-read it without a listed re-read trigger.
- **Context7** (`resolve-library-id` then `query-docs`): consult current docs
  before judging or writing library-specific code — Next.js App Router and
  server actions, Auth.js (next-auth v5 beta), Drizzle ORM/drizzle-kit, Zod,
  Playwright, Tailwind. Training-data knowledge of these APIs may be stale;
  a reviewer finding that contradicts current official docs is invalid.

## Authority and scope

Resolve decisions in this order:

1. the user's explicit request and approval;
2. `docs/NOW.md` for current focus, build order, and short-term agreements;
3. `docs/agent-handoff.md` and `docs/agent-crossover-contract.md` for
   cross-agent ownership, in-flight handoffs, and protected files;
4. `docs/PROJECT_CONTEXT.md` for canonical architecture and product intent;
5. `docs/DM-rules.md` for game adjudication rules (Accountant decides,
   Narrator only describes);
6. `docs/phased-plan.md` (plus linked planning docs such as
   `docs/multiplayer-design.md` and `docs/visual-multiplayer-phase0.md`) for
   phase sequencing, stack, exclusions, and gates;
7. executable repository evidence such as `package.json`, tests, migrations,
   and line checks;
8. `README.md`, `Project_README.md`, and `SMOKE.md` as convenience
   documentation.

Treat executable evidence as authoritative for volatile facts such as current
test counts and file sizes. Do not silently resolve conflicting product or UI
decisions; surface them to the user.

Respect file ownership declared in `docs/agent-crossover-contract.md` and
active entries in `docs/agent-handoff.md`. A change to another agent's owned
file requires the narrowest possible touch and an explicit handoff-ledger note.

Do not advance to a later roadmap phase merely because the implementation is
possible. Keep human gate evidence (playtest comprehension, fun, real-device
checks) separate from automated engineering evidence.

## Clean-context workflow

Use fresh agents with no inherited conversation history for every numbered
phase. Give each agent only the task packet defined in the reference.

### 1. Scope

Spawn a read-only scope agent. Require it to:

- read the governing documents and inspect current code/status (Repowise
  `get_context`/`repowise ask` first, raw reads second);
- identify the active roadmap item, build-order entry, or correction being
  addressed;
- define observable acceptance criteria, in-scope files/behaviors, exclusions,
  protected changes (including other agents' owned files), and manual evidence;
- flag stale documentation, contradictions, unsupported scope growth, and
  decisions requiring the user.

The coordinator converts the result into a concise scope contract. Do not
implement until the contract is internally consistent and authorized.

### 2. Plan

Spawn a fresh read-only planner with only the scope contract, governing
document paths, repository status, and relevant raw files. Require a minimal
sequence, target responsibility boundaries, focused regression coverage,
verification, and manual/browser routes. Reject speculative abstractions and
unrelated cleanup.

### 3. Implement

If the user requested only an audit or review, skip this phase. Freeze the
current tree, run independent reviews, and report findings without editing. Do
not spawn a fixer unless the user also authorized corrections.

Spawn a fresh implementer as the sole writer. Give it the accepted contract and
plan, allowed change areas, protected paths, and verification commands.
Require:

- the smallest coherent implementation;
- deterministic, pure TypeScript game resolution in `lib/game/engine` and
  `lib/game/state` — independent of React, the DOM, and the database; same
  input + same state = same outcome except through seeded, visible dice;
- the Accountant/Narrator split: rules, rolls, and state updates resolve
  server-side; narration and renderers describe outcomes without deciding
  them (`LogEntry.summary` stays canonical, flavor stays optional);
- React components and the visual shell display view-model state
  (`lib/visual/view-model.ts`) without embedding game rules;
- persistence-shape changes to `saved_games.game_state` or session/actor
  state come with Zod schema updates in `lib/game-schema.ts`, safe defaults,
  and a migration path (`scripts/migrate-saves.ts` / drizzle migrations) or a
  consciously documented reset policy;
- story and rules data changes stay in `story/*.json` and `data/5e/*.json`
  with code reading them generically;
- focused tests for changed rules and failure modes in
  `tests/game-engine-regression.ts`, and Playwright coverage in `e2e/` for
  changed user-visible flows;
- implementation and style files below 700 physical lines, split only at real
  responsibility boundaries;
- preservation of public imports where practical;
- the full verification suite (below) before handoff.

### 4. Freeze and verify

Stop all writers. Run:

```bash
node .claude/skills/enforce-dungeoncrawler-uniformity/scripts/revision-snapshot.mjs compare /tmp/<task>-baseline
node .claude/skills/enforce-dungeoncrawler-uniformity/scripts/revision-snapshot.mjs snapshot /tmp/<task>-frozen-<cycle>
npx tsc --noEmit
npm run lint
npm run test:unit
node .claude/skills/enforce-dungeoncrawler-uniformity/scripts/revision-snapshot.mjs verify /tmp/<task>-frozen-<cycle>
```

This tsc + lint + unit trio is the canonical verification suite ("verify"
throughout this skill). Wrap the noisy commands in `repowise distill` when
available. Additionally:

- For engine, action, UI, or e2e-covered changes, run the relevant Playwright
  specs (`npm run test:e2e` or a targeted `npx playwright test e2e/<spec>`),
  which need a working database (`npm run db:migrate` against local
  Postgres/docker-compose). If the environment cannot provide this, record it
  as a blocker — never as a pass.
- For dependency changes, also run `npm audit --audit-level=high`.
- For schema changes, confirm drizzle migrations are generated and applied
  (`npm run db:generate` / `npm run db:migrate`).
- For UI/runtime changes, start `npm run dev` and prepare the browser routes
  named in the scope contract. A server response alone is not visual or
  interaction evidence.

The baseline snapshot must have been created before Phase 3 with the same
`snapshot` command and a unique path outside the repository. `compare` supplies
the exact changed-path list plus baseline blob locations for review.

Record the frozen stamp, compare output, command output, and any known
environment or manual blockers. Spawn a fresh read-only verification agent to
verify the snapshot stamp before and after repeating the relevant checks. A
changed stamp invalidates the pass.

### 5. Review independently

Spawn two fresh read-only agents on the same frozen stamp, in parallel when
capacity permits:

- a code reviewer using the code rubric in the reference;
- a frontend reviewer using the frontend rubric and rendered app.

Require each reviewer to verify the frozen snapshot at the start and end of its
inspection and report both observed stamps. Do not give either reviewer the
implementer's reasoning, prior review reports, or the expected answer. Give raw
artifacts, the scope contract, relevant governing documents, and the frozen
revision. Reviewers must use the structured report in the reference. Reviewers
should use Repowise for orientation and Context7 to check library-usage
findings against current docs before reporting them.

The frontend reviewer must use an available browser-control skill (e.g.
claude-in-chrome) when the scope requires rendered UI evidence. If the required
browser, database, or route is unavailable, return `blocked`; never infer a
rendered pass from source inspection. Record physical-touch, screen-reader,
comprehension, and enjoyment checks as outstanding human gate evidence. They
block engineering clear only when the user's explicit acceptance criteria
require that human evidence now.

### 6. Adjudicate and fix

The coordinator deduplicates reports and accepts every evidence-backed
in-scope finding. Preference-only suggestions and later-phase ideas go to scope
notes. Resolve conflicting findings against the authority order; ask the user
if the conflict changes mechanics, balance, architecture, dependencies,
acceptance criteria, or phase scope.

If authorized corrections remain, spawn a fresh fixer as the sole writer. Give
it the full standard task packet plus the accepted finding IDs, evidence, and
required results. Withhold reviewer opinions and rejected findings. After any
edit, discard every earlier frozen snapshot, verification pass, and review
verdict. Return to Phase 4 with fresh agents.

## Completion rule

Declare **engineering clear** only when all are true on the same revision
stamp:

- canonical verification (tsc, lint, unit regression) passes, plus every
  additional check the scope contract requires;
- the independent verification agent reports clear;
- the independent code reviewer reports `clear` with no findings;
- the independent frontend reviewer reports `clear` with no findings and all
  relevant rendered routes covered;
- no accepted finding, unexplained change, or unresolved document conflict
  remains;
- documentation affected by the change matches the code, including
  `docs/NOW.md` status and an `docs/agent-handoff.md` entry when the change
  touches shared or other-agent-owned files.

Immediately before declaring clear, the coordinator must verify the frozen
snapshot once more. The verifier and both reviewers must have reported
identical start and end stamps.

Do not substitute extra review iterations for unavailable evidence. If an
external condition prevents a review required by the scope contract, stop with
`blocked`, name the missing evidence and owner, and preserve completed
engineering evidence.

Engineering clear does not pass any human product gate. Player comprehension,
enjoyment, real-device touch quality, and screen-reader behavior require the
manual sessions named in `SMOKE.md`, `docs/deploy-checklist.md`, and the
roadmap.

## Final handoff

Report:

- the scope contract and roadmap/build-order item;
- implemented behavior and affected responsibility boundaries;
- revision stamp and review-cycle count;
- verification commands and outcomes;
- code and frontend verdicts;
- remaining manual evidence or exact blockers;
- changed files, including updated project documents (`docs/NOW.md`,
  `docs/agent-handoff.md`, `docs/SESSION_NOTES.md` as the session protocol
  requires).

Do not say "no findings" if a reviewer was blocked, coverage was omitted, or
the revision changed after approval.
