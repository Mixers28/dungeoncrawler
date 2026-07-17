# Session Notes – Session Memory (SM)

> Rolling log of what happened in each focused work session.  
> Append-only. Do not delete past sessions.

---

## Example Entry

### 2025-12-01

**Participants:** User,VS Code Agent, Chatgpt   
**Branch:** main  

### What we worked on
- Set up local MCP-style context system.
- Added session helper scripts and VS Code tasks.
- Defined PROJECT_CONTEXT / NOW / SESSION_NOTES workflow.

### Files touched
- docs/PROJECT_CONTEXT.md
- docs/NOW.md
- docs/SESSION_NOTES.md
- docs/AGENT_SESSION_PROTOCOL.md
- docs/archive/process/MCP_LOCAL_DESIGN.md
- scripts/session-helper.ps1
- scripts/commit-session.ps1
- .vscode/tasks.json

### Outcomes / Decisions
- Established start/end session ritual.
- Agents will maintain summaries and NOW.md.
- This repo will be used as a public template.

---

## Session Template (Copy/Paste for each new session)
## Recent Sessions (last 3-5)

### 2026-07-09

**Participants:** User, Codex Agent  
**Branch:** main  

### Summary of work
- Cleaned and refactored `docs/` by separating active documentation from stale, superseded, historical, and template/process material.
- Added `docs/README.md` as the active documentation index.
- Archived old implementation notes, completed sprint/story plans, deprecated docs, and template workflow files under `docs/archive/`.
- Updated active roadmap/context/protocol links so future agents load current docs first.

### Files touched
- docs/README.md
- docs/AGENT_SESSION_PROTOCOL.md
- docs/NOW.md
- docs/PROJECT_CONTEXT.md
- docs/SESSION_NOTES.md
- docs/agent-handoff.md
- docs/multiplayer-design.md
- docs/phased-plan.md
- docs/visual-multiplayer-phase0.md
- docs/archive/**

### Outcomes / Decisions
- Active top-level docs are now limited to current memory, roadmap, deployment, rules, multiplayer/visual references, asset-generation workflow, and agent handoff/ownership docs.
- Archived docs are retained for context only and should not be treated as source of truth.

### 2026-07-09

**Participants:** User, Codex Agent  
**Branch:** main  

### Summary of work
- Stabilized visual interaction so the Interact button resolves obvious scene exits such as gates/doors instead of dispatching a generic no-op action.
- Brought the wizard visual spellbook into parity with the non-visual spell list by showing known spells with `Cantrip`, `Prepared`, and `Known` states.
- Added visual corpse-loot support: dead monsters remain visible as corpse standees, show `Loot`/`Looted` controls, and dispatch targeted loot commands.
- Increased monster standee readability and wired generated dead-state monster derivatives through the visual manifest.
- Saved the resume state in `docs/agent-handoff.md` and refreshed working memory docs.

### Files touched
- components/visual/DungeonViewport.tsx
- components/visual/SpellbookDrawerContent.tsx
- data/visual/asset-manifest.json
- docs/agent-handoff.md
- docs/NOW.md
- docs/SESSION_NOTES.md
- docs/PROJECT_CONTEXT.md
- e2e/visual-mode.spec.ts
- lib/game/engine/index.ts
- lib/visual/assets.ts
- lib/visual/view-model.ts
- public/visual/monsters/*_dead.png
- public/visual/spells/fallback_spell.svg
- tests/game-engine-regression.ts

### Outcomes / Decisions
- Current validation passed: `npm run db:migrate`, `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, and `npx playwright test e2e/visual-mode.spec.ts`.
- Manual visual shell and spellbook screenshots were saved under `test-results/manual-visual-qa/`.
- Next recommended step is normal-browser review of the visual asset/UI batch, then fuller M3 e2e coverage for multiplayer combat -> corpse loot -> scene transition.

### 2025-12-20

**Participants:** User, Codex Agent  
**Branch:** dcv01  

### Summary of work
- Added spell roll tracking to restore Dice Tray visibility during spell combat (attack and save).
- Split the UI sidebar into left/right panels for stats/inventory and spells/targets/dice.
- Added missing mechanics entry for Identify in the SRD overlay data.

### Files touched
- lib/game-schema.ts
- lib/game/state.ts
- lib/game/engine/index.ts
- components/DiceTray.tsx
- components/LeftSidebar.tsx
- components/RightSidebar.tsx
- app/page.tsx
- data/5e/ability-mechanics.json

### Decisions made
- Track spell attack/save rolls in `lastRolls` to keep Dice Tray active after spell casts.
- Split sidebar content into two panels for improved readability on desktop.

### 2025-12-20

**Participants:** User, Codex Agent  
**Branch:** dcv01  

### Summary of work
- Added mechanics overlay data from SRD spells and merged it into the 5e reference layer.
- Began data-driven spell resolution using mechanics metadata, keeping fallback spell cases.
- Added trader visibility cues in look summaries and the sidebar.
- Consolidated story progression docs into a phased roadmap and drafted future branching scene JSONs.
- Standardized documentation format for DM rules and updated sprint checklists.

### Files touched
- data/5e/ability-mechanics.json
- lib/5e/reference.ts
- lib/game/engine/index.ts
- components/GameSidebar.tsx
- docs/DM-rules.md
- docs/phased-plan.md
- docs/to-dos.md
- docs/archive/historical/dcv01-notes.md
- docs/archive/planning/stunt-system-sprint.md
- docs/future-story-progression-sprint.md
- docs/archive/historical/Possible_story_build.md
- docs/archive/planning/story-progression-roadmap.md
- story/future_*.json
- docs/PROJECT_CONTEXT.md
- docs/NOW.md
- docs/SESSION_NOTES.md

### Decisions made
- Use an SRD-based mechanics overlay for spells and merge it into local 5e data.
- Treat Phase 1 authored branching scenes as the quick win, with procedural routes as Phase 2.

### 2025-12-20

**Participants:** User, Codex Agent  
**Branch:** dcv01  

### Summary of work
- Ran a stability/consistency hardening pass after the game-engine refactor.
- Added explicit equipped item tracking and aligned AC calculations with equipped gear.
- Added scene image fetch timeout handling and resolved lint issues.
- Ran `npm run lint` and `npm run build` to confirm the branch is green.

### Files touched
- lib/game-schema.ts
- lib/game/state.ts
- lib/game/engine/index.ts
- scripts/write-build-info.js
- lib/build-info.ts
- docs/PROJECT_CONTEXT.md
- docs/NOW.md
- docs/SESSION_NOTES.md

### Decisions made
- Track equipped gear explicitly in inventory and compute AC from equipped items only.
- Use a bounded timeout for scene image fetches to avoid blocking turns.

### 2025-12-19

**Participants:** User, Codex Agent  
**Branch:** dcv01  

### What we worked on
- Updated Next.js to 14.2.35 and aligned ESLint tooling after audit fixes.
- Consolidated story assets to `story/` and corrected doc references/mismatches.
- Added cache pruning limits for scene images and pushed to `dcv01`.
- Ran `npm run lint` and `npm run build` to validate the branch.

### Files touched
- app/actions.ts
- package.json
- package-lock.json
- README.md
- docs/archive/historical/PRODUCT_BRIEF_ONE_PAGER.md
- docs/archive/historical/dcv01-notes.md
- docs/archive/historical/dcv01-notes.md
- PROJECT_STATUS.md
- docs/PROJECT_CONTEXT.md
- docs/NOW.md
- Story/* (removed duplicate directory)

### Outcomes / Decisions
- Railway deploy target confirmed as `dcv01`.
- Scene cache now prunes by size and file count to avoid unbounded growth.
- Story assets are consolidated under `story/` going forward.

### 2025-12-01 (Session 2)

**Participants:** User, Codex Agent  
**Branch:** main  

### What we worked on
- Re-read PROJECT_CONTEXT, NOW, and SESSION_NOTES to prep session handoff.
- Tightened the summaries in PROJECT_CONTEXT.md and NOW.md to mirror the current project definition.
- Reconfirmed the immediate tasks: polish docs, add an example project, and test on a real repo.

### Files touched
- docs/PROJECT_CONTEXT.md
- docs/NOW.md
- docs/SESSION_NOTES.md

### Outcomes / Decisions
- Locked the near-term plan around doc polish, example walkthrough, and single-repo validation.
- Still waiting on any additional stakeholder inputs before expanding scope.

### 2025-12-01

**Participants:** User, Codex Agent  
**Branch:** main  

### What we worked on
- Reviewed the memory docs to confirm expectations for PROJECT_CONTEXT, NOW, and SESSION_NOTES.
- Updated NOW.md and PROJECT_CONTEXT.md summaries to reflect that real project data is still pending.
- Highlighted the need for stakeholder inputs before populating concrete tasks or deliverables.

### Files touched
- docs/PROJECT_CONTEXT.md
- docs/NOW.md
- docs/SESSION_NOTES.md

### Outcomes / Decisions
- Documented that the repo currently serves as a template awaiting real project data.
- Set the short-term focus on collecting actual objectives and backlog details.

### [DATE – e.g. 2025-12-02]

**Participants:** [You, VS Code Agent, other agents]  
**Branch:** [main / dev / feature-x]  

### What we worked on
- 

### Files touched
- 


### Outcomes / Decisions
-

## Archive (do not load by default)
...
