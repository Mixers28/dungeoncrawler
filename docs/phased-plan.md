---
name: phased-plan
description: Source of truth for dcv01 branch scope and roadmap
---

# dcv01 Branch Plan (Source of Truth)

Unify the 5e reference integration work, current dcv01 behaviors, and remaining gaps into a single source-of-truth document. This plan tracks what is already wired, what remains, and how to validate changes.

Note: This is the canonical roadmap for dcv01. Other planning docs are supplemental only.

## Branch scope (current reality)
- Facts-first logs: `LogEntry.summary` is canonical; optional canned flavor comes from `data/narration/*.json`.
- Structured intents for attack/defend/run/look/check-sheet/cast-ability with quick-insert buttons in the sidebar.
- 5e reference layer (`data/5e/*.json`) for weapons/armor/skills/spells/loot; starter prefabs in `data/5e/char_*.json`.
- Story graph from `story/*.json` with exits, spawns, rewards, and location history.
- Combat + spells resolve deterministically with slot/prepared checks and a small set of modeled effects.
- UI: dice tray for last rolls and image fallback for scene art.
- Loot: scene rewards and corpse looting via `data/5e/loot/*.json`.
- Saves: localStorage with hydration/backfill; Supabase used for auth/leaderboard if configured.

## Requirements
- Drive abilities, skills, weapons, armor, and basic actions from `data/5e/*.json` via typed reference helpers.
- Keep the Accountant deterministic; narration stays flavor-only and never invents mechanics.
- Ensure sheet outputs (skills/abilities/inventory) are factual and derived from 5e data + GameState.

## Status (current)
- [x] 5e reference layer exists (`lib/5e/reference.ts`) with typed data and lookup maps.
- [x] Intent parsing uses 5e data (`lib/5e/intents.ts`, `lib/game/intent.ts`).
- [x] Structured intents drive combat/sheet routing in `lib/game/engine/index.ts`.
- [ ] Ability resolution is fully data-driven from 5e JSON (still partially hardcoded in `lib/game/engine/index.ts`).
- [ ] Class → allowed abilities/skills/proficiencies fully derived from 5e JSON (partial).
- [ ] Sheet outputs fully sourced from 5e reference data (partial).

## Scope
- In: 5e reference wiring, intent parsing, deterministic resolution, sheet outputs, narration guardrails.
- Out: model-based mechanics, bespoke per-action rules, non-deterministic systems.

## Files and entry points
- `lib/5e/reference.ts`
- `lib/5e/intents.ts`
- `lib/game/intent.ts`
- `lib/game/engine/index.ts`
- `data/5e/*.json` (read-only)

## Current behaviors (dcv01)
- `check skills` → factual skills + equipped weapon/armor; no narrator.
- `attack ...` → weapon dice from 5e data; facts include weapon name.
- `cast <starter spell>` → mechanics for starter set; slots enforced; unknown/unprepared spells rejected.
- `look around` → factual location/threat scan plus optional flavor.
- Story exits and rewards are driven by `story/*.json` and tracked via `storySceneId`/`storyFlags`.
- Sidebar provides quick actions for spells/skills/weapons and shows collapsible spellbook/backpack.

## Known gaps
- Ability resolution only covers a starter subset; higher-level abilities are unmodeled.
- Class proficiency mapping is partially hardcoded; not fully derived from 5e JSON.
- Sheet outputs are not fully driven by the reference layer.
- Narration guardrails are enforced via canned flavor and state-derived context.

## Action items
[ ] Complete data-driven ability resolution using `abilitiesById` and reference metadata (damage, cost, requirements).
[ ] Expand class reference mapping (allowed abilities/skills/weapons/armor) from 5e data where possible.
[ ] Update sheet outputs to use reference data for skills/abilities/equipment descriptions.
[ ] Add deterministic tests/fixtures for intent parsing and ability resolution.
[ ] Find or author mechanics data for the 195 missing non-SRD spells and merge into the overlay.

## Story progression roadmap (supplemental details in `docs/story-progression-roadmap.md`)
- Phase 1 (authored branches): add mid-branch scenes with gated exits, key/map/sigil loop, and deterministic variants.
- Phase 2 (procedural routes): introduce route modules, seeded junctions, and deterministic segment generation.

Action items (Phase 1):
[x] Wire exit gating for `entryConditions` and `consumeItem` in the engine.
[ ] Add seed + visit-index selection for `future_*` group variants.
[ ] Add discovery chances for keys/maps via search/investigate rewards.
[ ] Wire Act 1 entry to the new hub scenes and convergence conditions.

Validation:
- Manual: hub offers 3 distinct exits.
- Manual: keys/maps gate optional areas correctly.
- Manual: boss unlocks after all three branches cleared.
- Manual: different seeds yield different variants with the same arc.

## Stunt system status (supplemental details in `docs/stunt-system-sprint.md`)
- Implemented in `lib/stunts.ts` and integrated after explicit command parsing in `lib/game/engine/index.ts`.
- Follow-ups: add deterministic tests for `resolveStunt` and decide where temporary effects should live on `GameState`.

## UI/UX and tests (forward work)
- [x] UI: quick-use for consumables (Sprint 2; sidebar Use buttons + 5e SRD consumable catalog).
- [x] Spells: expanded effects (buffs/conditions/AoE) — Sprint 2.
- [x] Quests: sidebar shows active quests with objective tracking — Sprint 2.
- Loot/gear: broaden monster->loot mapping, add display names/types, and support potions/scrolls from inventory.
- Spells: add rest/slot recovery.
- Level-up: grant class-based benefits (slots/spells/features), not just +HP; surface a level-up notice.
- Tests: add smoke coverage for loot mapping, spell casting, and scene transitions (Sprint 3).

## Testing and validation
- `npm run lint`
- `npm run build`
- Manual: `check skills`, `attack`, `cast <starter spell>`, `look around`.

## Risks and edge cases
- Over-eager intent matching could misclassify commands.
- Partial reference data coverage may require safe fallbacks.

## Open questions
- Do we want to add per-class allowed-ability metadata directly to JSON or keep it in code?

## Quick smoke
- See `SMOKE.md` for manual steps.
