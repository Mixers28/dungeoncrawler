# Dungeon Portal review loop reference

Read this reference in full whenever the skill runs.

## Contents

- [Task packet](#task-packet)
- [Code review rubric](#code-review-rubric)
- [Frontend review rubric](#frontend-review-rubric)
- [Reviewer report](#reviewer-report)
- [Loop rules](#loop-rules)

## Task packet

Give every fresh agent a compact packet with:

```yaml
task_id: "<stable task name>"
role: "scope | plan | implement | verify | code-review | frontend-review | fix"
spawn_context: "fresh agent, no inherited history"
repository: "/absolute/path/to/dungeoncrawler"
revision: "<base or frozen stamp>"
baseline_snapshot: "/tmp/<task>-baseline"
frozen_snapshot: "/tmp/<task>-frozen-<cycle>"
objective: "<one bounded outcome>"
roadmap_item: "<phase / build-order entry from docs/NOW.md or docs/phased-plan.md>"
acceptance:
  - "<observable requirement>"
in_scope:
  - "<behavior or path>"
out_of_scope:
  - "<explicit exclusion>"
protected_changes:
  - "<existing user-owned path, other-agent-owned file, or diff>"
governing_documents:
  - "docs/NOW.md"
  - "docs/agent-handoff.md"
  - "docs/agent-crossover-contract.md"
  - "docs/PROJECT_CONTEXT.md"
  - "docs/DM-rules.md"
  - "docs/phased-plan.md"
verification:
  - "npx tsc --noEmit"
  - "npm run lint"
  - "npm run test:unit"
  - "<scope-required extras: targeted playwright specs, npm audit, db:migrate>"
tooling:
  - "Repowise for locate/understand/risk/health; `repowise distill` for noisy commands"
  - "Context7 for current Next.js / Auth.js / Drizzle / Zod / Playwright docs"
manual_evidence:
  - "<route, viewport, device, or human question>"
known_blockers:
  - "<none or exact blocker>"
required_output: "<role-specific report>"
```

Omit prior conclusions and reviewer opinions. Include a diff or raw files, not
a summary designed to steer the reviewer.

Revision snapshots include Git-tracked and non-ignored untracked paths, file
type, mode, symlink target, worktree content, index state, and `HEAD`. They
intentionally exclude `.git` internals and ignored caches, dependencies, build
outputs, and local environment files. The baseline stores content-addressed
blobs outside the repository so reviewers can inspect an exact pre-edit file.

## Code review rubric

Review the complete frozen change and affected call paths. Verify
library-usage claims (Next.js server actions, Auth.js v5, Drizzle, Zod,
Playwright) against current Context7 docs before reporting them as findings.

### Scope and architecture

- The change maps to the approved current roadmap/build-order item and does
  not smuggle in later-phase systems or excluded mechanics.
- Game resolution stays deterministic, pure TypeScript in `lib/game/engine`
  and `lib/game/state`, independent of React, the DOM, and the database.
- The Accountant/Narrator split holds: server-side resolution decides rules,
  rolls, state updates, loot, XP, and conditions; narration and rendering only
  describe decided outcomes. `LogEntry.summary` remains canonical; canned
  flavor from `data/narration/*.json` remains optional and mechanically inert.
- Renderers and the visual shell consume `lib/visual/view-model.ts` output;
  no game rules hide in components, and no UI policy hides in state
  transitions.
- Server actions in `app/actions.ts` validate input, resolve authoritatively,
  and never trust client-supplied outcomes.
- File ownership from `docs/agent-crossover-contract.md` and active
  `docs/agent-handoff.md` entries is respected; cross-ownership touches are
  minimal and logged.
- Public imports remain compatible where practical; any break is intentional
  and covered.
- No unrelated user changes are overwritten or reformatted.

### Correctness and causality

- State transitions preserve HP, inventory, equipment, spell slots,
  prepared/known spells, XP, gold/loot, conditions, location history, story
  gates/discoveries, and multiplayer per-actor state invariants.
- Randomness is seeded, visible when relevant (dice tray / log), and does not
  obscure diagnosis. Same input + same state = same outcome except through
  seeded dice.
- Command parsing, disabled controls, and log/event messages agree with the
  actual rule that fired.
- Edge cases cannot create dead ends, duplicate loot, invalid targets,
  contradictory results, or silently divergent multiplayer session state.
- Story graph changes keep exits, spawns, rewards, gates, and boss unlocks
  consistent with `story/*.json` and their regression coverage.

### Persistence and data

- New persisted fields in `saved_games.game_state` or session/actor tables
  have Zod validation in `lib/game-schema.ts`, defaults, and a migration path
  (drizzle migration and/or `scripts/migrate-saves.ts`) or a consciously
  documented reset policy.
- Invalid nested data falls back safely on hydration. Old saves remain
  loadable when promised.
- Rules/reference data stays in `data/5e/*.json` and story content in
  `story/*.json`; balance constants and pure formulas remain separate from
  transitions.
- Auth and session handling changes preserve Auth.js credential flow and
  never expose secrets or weaken password handling (bcryptjs).

### Maintainability

- Names and types describe the product concept consistently across code,
  copy, tests, and docs.
- Repetition is removed only at a stable responsibility boundary.
- No implementation/style file reaches 700 physical lines. Approaching files
  are assessed for a safe cohesive split, not compressed to game the guard.
  Known oversized hotspots (`lib/game/engine/index.ts`) must not grow.
- Comments explain non-obvious constraints, not the syntax.
- Repowise `get_health` on touched files shows no new regressions the change
  could reasonably have avoided.

### Tests and build

- Focused tests would fail before the fix and cover success plus meaningful
  failure/compatibility/migration cases (`tests/game-engine-regression.ts`
  for rules; `e2e/*.spec.ts` for user-visible flows).
- Existing deterministic regression comparisons remain meaningful.
- `npx tsc --noEmit`, `npm run lint`, and `npm run test:unit` pass on the
  frozen stamp; scope-required Playwright specs pass or are recorded as
  environment blockers.

## Frontend review rubric

Inspect the rendered app and the source that drives each affected state.

### Information architecture

- The app's stable surfaces remain coherent: login/splash/landing, class or
  character select, text-mode play (command input, quick-insert intents,
  sidebar, dice tray), visual mode (`VisualDungeonShell` viewport, movement
  and action tray, drawers for inventory/spellbook/log), and multiplayer
  session flows. Each changed control belongs to the responsible surface.
- Text mode and visual mode present the same authoritative state; neither
  invents outcomes the engine did not produce.
- No unrelated navigation destinations, orphaned screens, or empty shells
  appear.

### Visual language and consistency

- New UI uses the existing Tailwind-based language: spacing rhythm, panel and
  drawer patterns, action-tray button styles, typography, colors, and state
  patterns already in `app/globals.css` and `components/`.
- Equivalent actions, cards, headings, empty states, status messages, and
  stats use consistent wording and hierarchy across text and visual modes.
- State is communicated by text and structure, not color alone.
- The primary action remains obvious at desktop and supported narrow layouts;
  the viewport, log, and trays do not compete with or cover each other.
- Scene art falls back gracefully (placeholder/fallback image path) when an
  asset is missing from the manifest.

### Interaction and causality

- Labels describe actions precisely; buttons that resolve a turn disable
  while a turn is in flight.
- Disabled controls have a visible adjacent reason matching the true rule
  (e.g. no slots left, target dead, not owned).
- Success, failure, loading/resolving, empty, locked, selected, equipped,
  dead/lootable, and pending states remain legible.
- Log entries, dice results, HP/slot changes, and loot use consistent
  language with visible causes; the Adventure Log agrees with what happened.
- Every pointer interaction retains a click/keyboard alternative.

### Accessibility and responsiveness

- Inactive views/drawers are removed from focus and reading order (native
  `hidden` or unmount), and selected navigation state is exposed
  semantically.
- Keyboard order is predictable; focus remains visible.
- Interactive targets remain at least 44 CSS pixels where promised.
- At 390 x 844 and the desktop validation viewport, no primary action is
  covered, clipped, or forced behind unrelated content.
- Browser automation may establish DOM/layout/interaction evidence, but not
  physical-touch quality, screen-reader announcements, comprehension, or fun.

### Required routes

Select relevant routes from the scope contract. For broad UI changes cover:

- login → class/character select → continue-vs-new-run choice;
- text mode: command input, quick-insert intents, dice tray, sidebar sheet;
- visual mode: movement, attack, interact, loot (including corpse loot),
  inventory/spellbook/log drawers, monster states (live, dead, scaled);
- combat round-trip: attack → resolution → log → HP/slot updates;
- persistence reload and explicit new-run/abandon-save flows;
- multiplayer: session create/join, shared state visibility, per-actor turns;
- keyboard navigation and the narrow layout.

Mark unavailable routes `blocked`, not passed.

## Reviewer report

Return only this structure followed by brief evidence:

```yaml
revision: "<exact stamp>"
start_stamp: "<recomputed stamp before inspection>"
end_stamp: "<recomputed stamp after inspection>"
role: "code | frontend | verify"
verdict: "clear | findings | blocked"
coverage:
  - "<files, screens, routes, and viewports inspected>"
checks:
  - command: "<command or manual route>"
    result: "pass | fail | not-run"
findings:
  - id: "CODE-01 or UI-01"
    severity: "blocker | major | minor"
    location: "<file:line or screen/route/viewport>"
    requirement: "<contract or governing rule>"
    evidence: "<reproduction or mismatch>"
    impact: "<user or code consequence>"
    minimal_fix: "<bounded correction>"
    verify: "<focused recheck>"
blockers:
  - type: "environment | access | device | human-validation"
    reason: "<why coverage cannot complete>"
    owner: "<who can unblock it>"
    required_evidence: "<what closes it>"
scope_notes:
  - "<non-blocking later idea>"
```

A `clear` verdict requires an empty findings list and completed relevant
coverage. A preference without a violated contract or governing rule is a
scope note. Missing evidence is a blocker.

## Loop rules

- Any edit invalidates all prior stamps, passes, and verdicts.
- Create the baseline snapshot before the first writer. Use its compare
  output, not `git diff` alone, to identify changes in an unborn or untracked
  tree.
- Every verifier and reviewer verifies the frozen snapshot at inspection
  start and end. The coordinator verifies it again immediately before
  completion.
- A reviewer never fixes or approves its own work.
- Reviewers do not see each other's reports before submitting.
- Accept every reproducible in-scope finding; do not vote findings away.
- Check library-behavior findings against current Context7 docs before
  accepting them.
- Return repeated or conflicting blockers to the user when they require new
  authority or external evidence.
- Stop only on one revision with canonical verification and all relevant
  agents clear, or with an explicit blocker that cannot be resolved inside
  scope.
