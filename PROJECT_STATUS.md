# Dungeon Portal – Status

## Current Setup
- Next.js 14 App Router with Tailwind styling (`app/`), Supabase auth/session middleware (`middleware.ts`, `utils/supabase/*`).
- AI-backed game logic and narration in `app/actions.ts` using Groq-hosted models; game schema/types in `lib/`.
- Client gameplay UI in `app/page.tsx` with sidebar component `components/GameSidebar.tsx`; login flow at `app/login/page.tsx`.

## Changes Made (this pass)
- Fixed combat damage rolls with a dice parser that supports modifiers and multiple dice terms (`app/actions.ts`).
- Added saved-game hydration/validation to backfill defaults and rebuild derived fields like images/room registry when loading existing saves (`app/actions.ts`).
- Hardened Supabase persistence: upserts now check and surface errors during create, turn processing, and reset flows (`app/actions.ts`).
- Persisted resolved dice rolls (player/monster attack and damage) into game state for auditing or future UI (`app/actions.ts`, `lib/game-schema.ts`).
- Clamped story act to defined acts, and fed the narrator the current act, room description, and inventory to reduce hallucinations and keep plot/location anchored (`app/actions.ts`).
- Made turn resolution fully deterministic in JS (attack/defend/run logic, HP/AC updates, and combat summaries) so narrator, sidebar, and saves stay in sync (`app/actions.ts`).
- Refreshed sidebar synchronization by re-cloning nearby entities on updates so threat lists re-render reliably (`app/actions.ts`).
- Tightened narrator output: capped at 3 sentences, only mentions stats/inventory when changed, and enforces consistency with provided state (`app/actions.ts`).
- Included last roll values in narrator context and instructed it to never contradict HP/roll/entity data (`app/actions.ts`).
- Start-of-run is neutral (combat off) and monsters act only after hostile/defensive actions; “look” no longer triggers surprise damage (`app/actions.ts`).
- Narrator now uses provided roll values and HP delta and must not claim pending rolls or damage when none occurred (`app/actions.ts`).
- Scene images are cached locally in `public/scene-cache` keyed by scene+seed; repeat visits reuse cached files instead of re-calling the generator (`app/actions.ts`).
- Narrator prompt updated to mirror DM principles: concise (≤3 sentences), telegraph threats, no surprise damage without triggers, and must use provided rolls/HP/entity data faithfully (`app/actions.ts`).
- Added 5e reference snippets (abilities, conditions, basic actions) and fed them to the narrator for grounded descriptions (`data/5e/*`, `lib/refs.ts`, `app/actions.ts`).
- Expanded 5e references with skills-to-abilities, weapon table, armor table, and fuller conditions for future rule grounding (`data/5e/*`, `lib/refs.ts`).
- Scene cache now keeps a small variant pool per scene (3 variants) and reuses by scene key; variant chosen deterministically per run, avoiding re-generation while allowing variety (`app/actions.ts`).
- Added a simple loot heuristic to let the player retrieve the Iron Key when actions target the shiny object; adds to inventory, updates summary, and makes rats flee (`app/actions.ts`).
- Added location history tracking and a path mini-map in the sidebar to keep navigation and narrator in sync (`app/actions.ts`, `components/GameSidebar.tsx`, `lib/game-schema.ts`).
- Added level/XP tracking with basic XP thresholds and level-up HP bumps; starter mobs restricted to easy foes; XP awarded on kills (`app/actions.ts`, `lib/game-schema.ts`).
- Added quick-start class selection (Fighter/Rogue/Cleric/Wizard), storing archetype bonuses/items in state and showing class/XP in sidebar (`app/page.tsx`, `app/actions.ts`, `app/characters.ts`, `components/GameSidebar.tsx`, `lib/game-schema.ts`).
- Hardened narration/state sync: EVENT_SUMMARY is authoritative, no pending/future rolls, wounds only called out on HP loss, and empty summaries are prevented (`app/actions.ts`).
- Improved combat narration alignment: added alive threat context, forbid “pending” phrasing, require concrete hit/miss/damage lines, and blocked wound mentions when no HP loss; added generic corpse loot to keep inventory/narrative aligned (`app/actions.ts`).
- Updated references: PHB/DMG PDFs moved to `docs/`, README adjusted accordingly (`Project_README.md`).
- Room descriptions are now deterministic (no model generation) and narrator is clamped to provided location text to avoid scene hallucinations (`app/actions.ts`).

## Future Plans
- Add automated tests for dice parsing and state hydration to catch regressions.
- Build a migration helper/CLI to scan and repair legacy saves before load.
- Persist and display recent combat/narrative logs client-side for transparency and debugging.
