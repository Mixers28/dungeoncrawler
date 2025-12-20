---
name: phased-plan
description: Source of truth for 5e reference integration and dcv01 scope
---

# Plan

Unify the 5e reference integration work, current dcv01 behaviors, and remaining gaps into a single source-of-truth document. This plan tracks what is already wired, what remains, and how to validate changes.

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
- Out: LLM-based mechanics, bespoke per-action rules, non-deterministic systems.

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
- Narration guardrails are enforced via canned flavor, but prompt-level constraints should remain explicit.

## Action items
[ ] Complete data-driven ability resolution using `abilitiesById` and reference metadata (damage, cost, requirements).
[ ] Expand class reference mapping (allowed abilities/skills/weapons/armor) from 5e data where possible.
[ ] Update sheet outputs to use reference data for skills/abilities/equipment descriptions.
[ ] Add deterministic tests/fixtures for intent parsing and ability resolution.
[ ] Find or author mechanics data for the 195 missing non-SRD spells and merge into the overlay.

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
