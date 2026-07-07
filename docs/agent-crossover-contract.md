---
name: agent-crossover-contract
description: Ownership, handoff, and cross-audit rules for Codex backend work and Claude frontend work
---

# Agent Crossover Contract

> Status: active for Visual Multiplayer Phase 0 and later multiplayer work.

## Purpose

Codex and Claude Code will work in the same repo with separate primary ownership:

- Codex owns backend assembly, data contracts, deterministic game logic, persistence, validation, and backend audit.
- Claude Code owns frontend UI implementation, visual layout, interaction design, responsive behavior, and frontend audit.

Both agents review across the boundary:

- Codex audits frontend changes for contract misuse, missing state handling, broken commands, data-shape drift, and validation gaps.
- Claude Code audits backend changes for UI fit, prop ergonomics, missing presentation fields, excessive coupling, and awkward user flows.

The goal is not two isolated silos. The goal is one shared contract with clear ownership, explicit handoffs, and a second set of eyes on every boundary.

## Source Of Truth

Read these first, in order:

1. `docs/NOW.md` for current build order.
2. `docs/phased-plan.md` for canonical roadmap state.
3. `docs/visual-multiplayer-phase0.md` for the visual shell and asset plan.
4. `docs/multiplayer-design.md` for multiplayer session/state architecture.
5. `docs/agent-handoff.md` for active agent-to-agent handoffs.

## Ownership Matrix

| Area | Primary owner | Secondary reviewer | Notes |
|---|---|---|---|
| Game engine and deterministic rules | Codex | Claude Code | `lib/game/**`, `lib/5e/**`, `lib/story.ts`, `lib/rules.ts` |
| DB schema, migrations, auth, server actions | Codex | Claude Code | `lib/db/**`, `drizzle/**`, `auth*.ts`, `app/actions.ts`, API routes |
| Asset manifest schema and loader helpers | Codex | Claude Code | `data/visual/**`, `lib/visual/**`, public asset fallback rules |
| Generated asset pipeline and naming contracts | Codex | Claude Code | Prompt/style metadata, cache paths, manifest validation |
| Visual shell components and layout | Claude Code | Codex | `components/**`, visual-mode sections in `app/page.tsx`, CSS |
| Responsive and interaction polish | Claude Code | Codex | Mobile/desktop layout, drawers, controls, accessibility |
| E2E visual smoke flows | Shared | Shared | Claude writes UI flow; Codex verifies backend/state expectations |
| Unit/regression tests for data contracts | Codex | Claude Code | `tests/**`, schema loaders, command/action regressions |
| Copy, labels, and user-facing flow | Claude Code | Codex | Keep factual log language consistent with engine output |
| Roadmap and handoff docs | Shared | Shared | Update `docs/NOW.md`, `docs/phased-plan.md`, and `docs/agent-handoff.md` |

## File Boundaries

Codex may edit:

- `lib/**`
- `data/**`
- `story/**`
- `drizzle/**`
- `scripts/**`
- `tests/**`
- `e2e/**` when adding backend-dependent assertions
- `app/actions.ts`, API routes, auth files
- Docs

Claude Code may edit:

- `app/page.tsx`
- `app/globals.css`
- `components/**`
- `public/**` visual assets and placeholders
- `e2e/**` when adding UI flow coverage
- Docs

Shared/high-conflict files:

- `app/page.tsx`
- `app/actions.ts`
- `lib/game-schema.ts`
- `docs/NOW.md`
- `docs/phased-plan.md`
- `docs/agent-handoff.md`

Rule for shared files: announce intent in `docs/agent-handoff.md` before large edits. If the other agent has an active handoff touching the same file, coordinate first or split the change.

`app/page.tsx` seam for Visual Phase 0:

- Keep `/` as the gameplay route.
- Claude Code may add a small delegation point from `app/page.tsx` to `components/visual/VisualDungeonShell`.
- New visual UI logic should live under `components/visual/**`, not directly in `app/page.tsx`.
- `app/page.tsx` should continue owning save hydration, restart, death handling, and calls to `processTurn`.
- Text mode stays available until visual-mode smoke coverage passes.

## API And Contract Rules

Codex provides stable contracts for Claude:

- TypeScript types for visual assets, scene affordances, party slots, action availability, and log entries.
- Pure helpers where possible, so UI can render without duplicating game rules.
- Backward-compatible fields until Claude confirms migration is complete.
- Explicit fallback behavior for missing assets and unavailable actions.
- A `buildVisualGameViewModel(state)` helper before Claude wires final movement/action controls.

Claude provides concrete UI needs for Codex:

- Required fields and exact prop shapes.
- Missing states that block the visual shell.
- Needed command mappings for movement/action buttons.
- Any backend-derived display fields that would prevent frontend duplication.

Contracts should be additive first. Avoid removing or renaming fields in the same handoff that introduces a new UI.

## Handoff Format

Use `docs/agent-handoff.md` for every cross-agent handoff. Add entries at the top of the relevant section using this format:

```md
## Handoff - YYYY-MM-DD - Agent Name - Short Title

Owner: Codex | Claude Code
Status: proposed | ready-for-review | blocked | accepted
Files touched:
- `path/to/file`

Summary:
- What changed.

Contract changes:
- New fields, helpers, commands, or assumptions.

Validation:
- Commands run and result.

Needs from other agent:
- Specific review or implementation request.
```

Keep handoffs short. Link to files instead of copying code.

## Work Loop

1. Before editing, read `docs/agent-handoff.md` and `git status --short`.
2. Claim large shared-file work in the handoff ledger.
3. Make the change within your ownership area.
4. Run the smallest useful validation.
5. Add or update a handoff entry when another agent needs to consume or review the work.
6. Cross-audit before merging or calling a phase done.
7. Update `docs/NOW.md` when the active build order or validation state changes.

## Cross-Audit Checklist

Codex audits Claude frontend changes for:

- Buttons dispatch valid commands or server actions.
- UI does not infer rules that belong in the engine.
- Missing/null state is handled for saves, hydration, and old sessions.
- Visual asset fallbacks cannot break gameplay.
- E2E covers the new primary path.
- No accidental regression to text-only required flow.

Claude Code audits Codex backend changes for:

- Data contracts are ergonomic for components.
- Helpers avoid forcing frontend rule duplication.
- Field names are clear and stable.
- Loading/error/empty states are representable.
- Multiplayer turn ownership can be displayed cleanly.
- Backend changes support visual-first flow rather than preserving text-first assumptions.

## Visual Phase 0 Split

Codex first tasks:

- Add visual asset manifest schema.
- Add loader helpers and fallback resolution.
- Add scene/action affordance helpers that map current `GameState` to visual controls.
- Add regression tests for manifest loading and movement/action contracts.

Claude Code first tasks:

- Build `VisualDungeonShell` under `components/visual/**`.
- Claude may scaffold layout directly against current `GameState`, but final movement/action controls should consume Codex's visual view-model helper instead of duplicating exit/combat rules.
- Replace persistent sidebars in visual mode with drawers.
- Build movement cluster, action tray, compact log strip, and party rail.
- Add visual-mode smoke coverage once the shell is usable.

Shared acceptance:

- Solo smoke path works without free text.
- The shell can display four party slots without redesign.
- Full validation remains green.

## Conflict Rules

- Do not overwrite uncommitted changes from the other agent.
- Do not reformat large files outside your change scope.
- If a shared file has unrelated edits, patch around them.
- If both agents need the same file, split by interface first: Codex adds contract/helper, Claude consumes it after handoff.
- If a test fails in the other agent's area, document the failure and suspected contract issue before patching outside your ownership.

## Commit/PR Notes

When summarizing work, include:

- Ownership area changed.
- Contract changes.
- Cross-audit result.
- Validation commands.
- Remaining handoffs.
