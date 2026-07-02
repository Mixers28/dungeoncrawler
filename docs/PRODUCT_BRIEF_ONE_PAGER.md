# Dungeon Portal – Product Brief (One-Pager)

## 1. What it is

Dungeon Portal is a **text-first dungeon crawler** built on Next.js where gameplay outcomes are deterministic and auditable.

It uses a hybrid loop:
- **Accountant (TypeScript):** parses intent and resolves mechanics (rolls, damage, HP, loot, XP, story progression).
- **Narrator (canned lines):** adds **optional** flavor-only text sourced from `data/narration/*.json` and constrained to existing state.

## 2. Who it’s for

Players who:
- Enjoy classic dungeon crawl pacing and “type to play” interaction.
- Want transparency (clear outcomes and visible rolls).
- Want DM-like tone without sacrificing fairness or save integrity.

## 3. Core loop

1. Player enters an action (`look around`, `attack with longsword`, `cast healing word`).
2. Accountant resolves the turn deterministically and produces a factual `eventSummary`.
3. Narrator may add a single mood line constrained by strict bans.
4. UI renders state + log; server actions persist the validated save to Postgres through Drizzle.

## 4. Pillars

- **Facts-first:** `LogEntry.summary` is canonical.
- **Deterministic mechanics:** the model never decides outcomes.
- **Constrained narration:** flavor cannot add loot/exits/skills/rolls/numbers.
- **Config-driven content:** story scenes and 5e reference data are local files.

## 5. Current scope

- Quick-start archetypes (Fighter/Rogue/Cleric/Wizard)
- Story graph from `story/*.json` (exits/spawns/rewards)
- 5e reference layer (`data/5e/*`) for weapons/armor/skills/spells/loot
- Save/load via Drizzle/Postgres with schema hydration/backfill
- Auth.js credentials login backed by the local `users` table
- Scene images loaded from `public/scene-cache` (curated assets) with UI fallbacks when missing

## 6. Success criteria

- Player can understand why an outcome happened (and see the last resolved rolls).
- Narrator never contradicts state or invents mechanics/loot/exits.
- Loading older saves is safe via schema hydration/backfill.
