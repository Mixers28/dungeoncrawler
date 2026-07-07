---
name: phased-plan
description: Roadmap for Dungeon Portal mechanics, story progression, UI, and validation
---

# Dungeon Portal Roadmap

This is the canonical roadmap. Architecture and setup details live in `docs/PROJECT_CONTEXT.md`; current build order lives in `docs/NOW.md`.

Other planning docs are supplemental only unless linked here.

Linked planning docs:
- Visual multiplayer UI and asset plan: `docs/visual-multiplayer-phase0.md`
- Multiplayer session/state architecture: `docs/multiplayer-design.md`
- Codex/Claude ownership and audit contract: `docs/agent-crossover-contract.md`
- Active agent handoffs: `docs/agent-handoff.md`

## Branch scope (current reality)
- Facts-first logs: `LogEntry.summary` is canonical; optional canned flavor comes from `data/narration/*.json`.
- Structured intents for attack/defend/run/look/check-sheet/cast-ability/equip/drop with quick-insert buttons in the sidebar.
- 5e reference layer (`data/5e/*.json`) for weapons/armor/skills/spells/loot; starter prefabs in `data/5e/char_*.json`.
- Story graph from `story/*.json` with exits, spawns, rewards, and location history.
- Combat + spells resolve deterministically with slot/prepared checks and a small set of modeled effects.
- UI: dice tray for last rolls and image fallback for scene art.
- Loot: scene rewards and corpse looting via `data/5e/loot/*.json`.
- Saves: Drizzle/Postgres JSONB saves with Zod hydration/backfill.
- Auth: Auth.js credentials backed by `public.users`.
- Leaderboard: localStorage-only until a new global leaderboard design is implemented.

## Requirements
- Drive abilities, skills, weapons, armor, and basic actions from `data/5e/*.json` via typed reference helpers.
- Keep the Accountant deterministic; narration stays flavor-only and never invents mechanics.
- Ensure sheet outputs (skills/abilities/inventory) are factual and derived from 5e data + GameState.

## Status (current)
- [x] 5e reference layer exists (`lib/5e/reference.ts`) with typed data and lookup maps.
- [x] Intent parsing uses 5e data (`lib/5e/intents.ts`, `lib/game/intent.ts`).
- [x] Structured intents drive combat/sheet routing in `lib/game/engine/index.ts`.
- [x] Ability resolution is fully data-driven from 5e JSON (mechanics + authored `data/5e/ability-effects.json` overlay; no per-spell code paths remain in `lib/game/engine/index.ts`).
- [x] Class → allowed abilities/skills/proficiencies fully derived from 5e JSON (`data/5e/classes.json` + token resolver in `lib/5e/classes.ts`).
- [x] Sheet outputs fully sourced from 5e reference data (skills with governing ability, equipped weapon/armor with damage/AC/category, class proficiencies, spell levels).

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
- Many non-SRD spells still lack authored deterministic mechanics.
- Armor proficiency is surfaced but not enforced.
- Rest/slot recovery and class-based level-up benefits are incomplete.
- Loot/gear display names and item types need broader normalization.
- Stunt effects need deterministic regression tests and a clearer temporary-effect model.
- Playwright e2e should be run regularly against local Postgres.

## Action items
[x] Complete data-driven ability resolution from reference metadata (damage, cost, requirements).
    (Implemented via `data/5e/ability-effects.json`, an authored overlay merged over the
    5e-database mechanics in `lib/5e/reference.ts`. It adds a generic `effect` descriptor
    — self/enemy/none target, ac_bonus/attack_bonus/buff/debuff, value, duration, logs —
    interpreted by one engine branch; the ~100-line per-spell else-if chain is gone.
    The overlay also authors mechanics for the non-SRD cantrips Word of Radiance and
    Toll the Dead, and heal/damage dice now resolve the 5e-database "MOD" placeholder
    against the caster's spellcasting ability — previously Cure Wounds crashed the turn.)
[x] Expand class reference mapping (allowed abilities/skills/weapons/armor) from 5e data.
    (`data/5e/classes.json` defines per-class proficiency tokens — category prefixes like
    "simple"/"martial"/"light" expand against `weapons.json`/`armor.json`, exact names pass
    through — plus canonical skills. `lib/5e/classes.ts` resolves tokens at load and throws
    on unknown tokens/skills so bad data can't silently strip proficiencies. Output verified
    identical to the previous hardcoded mapping. This also answers the open question below:
    per-class metadata lives in JSON.)
[x] Update sheet outputs to use reference data for skills/abilities/equipment descriptions.
    (`check skills` now reports: class name; skills as canonical names with governing
    ability, e.g. "Insight (WIS)"; the *equipped* weapon with damage dice and category
    from `weapons.json`; equipped armor with base AC and category from `armor.json`;
    compact class proficiency tokens from `classes.json`; and spells with canonical
    casing and level from the spell catalog. Known/prepared spell lists are deduped
    case-insensitively at build and hydrate. Known data quirk: the cleric starter
    prefab equips Chain Mail (heavy) while class proficiencies are light/medium/shield —
    proficiency is not yet enforced for armor, only surfaced.)
[x] Add deterministic tests/fixtures for inventory command parsing and core weapon attack regressions.
[ ] Find or author mechanics data for the 195 missing non-SRD spells and merge into the overlay.
[ ] Add deterministic tests/fixtures for broader ability resolution.
[ ] Enforce or explicitly ignore armor proficiency in combat calculations.
[ ] Add rest/slot recovery and class-based level-up benefits.

## Story progression roadmap (supplemental details in `docs/story-progression-roadmap.md`)
- Phase 1 (authored branches): add mid-branch scenes with gated exits, key/map/sigil loop, and deterministic variants.
- Phase 2 (procedural routes): introduce route modules, seeded junctions, and deterministic segment generation.

Status:
- Phase 1 closed 2026-07-07. The authored branch flow is wired and covered by `npm run test:unit` regression checks for hub exits, item-gated side areas, discovery rewards, branch completion, boss gating, and seeded variants. Full local validation, including Playwright e2e against local Postgres, passes.
- Phase 2 is ready to start. The first implementation target is route-module data plus deterministic junction selection on top of the existing story scene/variant system.

Action items (Phase 1):
[x] Wire exit gating for `entryConditions` and `consumeItem` in the engine.
[x] Add seeded selection for `future_*` group variants (pinned per run by worldSeed + group hash; see roadmap doc for the deviation rationale).
[x] Add discovery chances for keys/maps via search/investigate rewards (data-driven `discovery` on scenes).
[x] Wire Act 1 entry to the new hub scenes and convergence conditions (gate → hub → 3 branches → boss → treasury).

Validation:
- [x] Automated: hub offers 3 distinct branch exits.
- [x] Automated: keys/maps/sigils gate optional areas and are consumed on entry.
- [x] Automated: branch completion flags are set when returning to the hub.
- [x] Automated: boss unlocks only after all three branches are cleared.
- [x] Automated: identical seeds pick identical variants while different seeds can vary.
- [x] Playwright e2e against local Postgres.

Action items (Phase 2):
[ ] Define route-module JSON shape for procedural route segments.
[ ] Add deterministic junction selection from `worldSeed` and current story flags.
[ ] Connect generated route segments back into authored convergence scenes.
[ ] Add regression coverage for seeded route reproducibility and replay variety.

## Visual multiplayer roadmap
- Phase 0 (visual shell and asset plan): Eye-of-the-Beholder-inspired first-person dungeon UI, compact party rail, button-driven movement/actions, asset manifest, and OpenAI-generated asset style guide.
- Phase M1 (state split): split `GameState` into session/character state behind a party-of-one shim.
- Phase M2 (sessions): session tables, join-by-code, turn gate, and polling sync.
- Phase M3 (party UI): actor-named logs, party controls, turn affordances, and balance knobs.

Status:
- Visual Phase 0 is functionally closed: full-time visual mode (exploration + combat, not combat-only), movement/action/inventory/spellbook all button-driven against `buildVisualGameViewModel`, Act 1 manifest coverage with deterministic placeholders, e2e smoke coverage, and the multiplayer-readiness review are complete. See `docs/visual-multiplayer-phase0.md` and `docs/multiplayer-readiness-review.md`.
- Generated final art remains polish; the functional requirement is local assets plus graceful fallbacks.
- Phase M1 has started with schemas and a party-of-one compatibility shim: `SessionState`, `CharacterState`, `splitGameStateForSolo`, and `composeGameStateForSolo` now have regression coverage.
- `docs/multiplayer-design.md` remains the architecture reference for Phase M1+.

Action items (Visual Phase 0):
[x] Add asset manifest types, loader helpers, and a `GameState` → visual view model contract.
[x] Build a single-player `VisualDungeonShell` on top of current `GameState`.
[x] Move movement, combat, inventory, spellbook, and log into the compact visual shell/drawer model.
[x] Seed Act 1 visual manifest coverage and fallbacks.
[x] Add visual-mode smoke coverage (`e2e/visual-mode.spec.ts`: shell landmarks, movement, inventory drawer, spellbook drawer).
[x] Complete multiplayer-readiness review.

Action items (Phase M1):
[x] Add `SessionState` and `CharacterState` schemas beside current `GameState`.
[x] Add party-of-one split/compose helpers.
[x] Add round-trip regression coverage for solo compatibility.
[ ] Migrate combat state access onto the split model behind the party-of-one shim.
[ ] Migrate casting, story/exits, loot/economy, and sheet fields in separate slices.

## Stunt system status (supplemental details in `docs/stunt-system-sprint.md`)
- Implemented in `lib/stunts.ts` and integrated after explicit command parsing in `lib/game/engine/index.ts`.
- Follow-ups: add deterministic tests for `resolveStunt` and decide where temporary effects should live on `GameState`.

## UI/UX and tests (forward work)
- [x] UI: quick-use for consumables (Sprint 2; sidebar Use buttons + 5e SRD consumable catalog).
- [x] Spells: expanded effects (buffs/conditions/AoE) — Sprint 2.
- [x] Quests: sidebar shows active quests with objective tracking — Sprint 2.
- [x] Inventory: equip/drop commands mutate state, recompute AC, and protect key items.
- [x] Combat: owned-weapon validation, equipped-weapon default attacks, matching requested-weapon damage dice, target-aware attacks.
- Loot/gear: broaden monster->loot mapping, add display names/types, and support potions/scrolls from inventory.
- Spells: add rest/slot recovery.
- Level-up: grant class-based benefits (slots/spells/features), not just +HP; surface a level-up notice.
- Tests: add smoke coverage for loot mapping, spell casting, inventory equip/drop, and scene transitions.

## Testing and validation
- `npm run test:unit`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e` with local Postgres and `.env.local`
- Manual: `check skills`, `attack`, `attack <target>`, `equip <item>`, `drop <item>`, `cast <starter spell>`, `look around`.

## Risks and edge cases
- Over-eager intent matching could misclassify commands.
- Partial reference data coverage may require safe fallbacks.

## Open questions
- ~~Do we want to add per-class allowed-ability metadata directly to JSON or keep it in code?~~
  Resolved 2026-07-02: JSON. Per-class proficiencies/skills live in `data/5e/classes.json`,
  and authored spell effects live in `data/5e/ability-effects.json`.

## Quick smoke
- See `SMOKE.md` for manual steps.
