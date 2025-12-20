---
name: stunt-system-sprint
description: Sprint plan for adding a generic stunt system
---

# Plan

Add a deterministic stunt system to resolve unusual player actions with skill checks, generic effects, and factual log summaries, while preserving existing command flows and narration integration.

## Requirements
- Introduce stunt templates and difficulty mapping with keyword-based classification.
- Resolve stunts deterministically: roll vs DC, apply low-impact effects, and log factual outcomes.
- Integrate stunts after explicit command parsing; sheet/meta commands must bypass stunts.
- Return a compatible narration mode for future flavor generation.

## Scope
- In: new stunt module, `_updateGameState` integration, basic effect/summary helpers.
- Out: LLM usage, complex 5e skill modeling, bespoke per-action rules.

## Files and entry points
- lib/stunts.ts
- app/actions.ts

## Data model / API changes
- Potentially add small flags or status fields on `GameState` (e.g., `flags`, `status`, or `nextAttackBonus`).
- Extend `_updateGameState` flow to return stunt-based `eventSummary` and `mode`.

## Action items
[x] Add `lib/stunts.ts` with templates, difficulty map, and `classifyStunt`.
[x] Implement `resolveStunt` and helpers (`getSkillModifier`, `applyStuntEffect`, `describeStuntConsequence`).
[x] Wire stunt classification into `_updateGameState` after explicit command handling.
[x] Ensure event summaries include roll vs DC and outcomes; keep consequences factual.
[x] Map stunt categories to narration modes for later flavor support.
[x] Verify explicit commands and sheet/meta queries bypass stunts.

## Testing and validation
- Manual: trigger sample stunts for each category and confirm summaries and state effects.
- Manual: ensure explicit commands (attack/search/loot/look/sheet) still route correctly.
- Optional: unit test `resolveStunt` with mocked roll for determinism.

## Risks and edge cases
- Over-eager keyword matching could misclassify explicit commands.
- GameState schema may lack obvious places for new flags; keep changes minimal.
- Effects should not be too punishing or derail core combat loops.

## Open questions
- Where should temporary stunt effects live on `GameState` (existing flags vs new field)?
