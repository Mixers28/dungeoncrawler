Phased Implementation Plan

5e Reference Layer
Add lib/5e/reference.ts with typed loaders (Zod) for weapons, armor, abilities/spells, skills, basic actions from data/5e.
Export lookup maps by id/name and optional aliases.
Validation smoke test to catch malformed entries.
Class Mapping & Sheet Data
Define ClassReference mapping (class key → allowedAbilities/skills/weapons/armor) using the reference data plus app/characters.ts defaults.
Add any needed GameState fields (e.g., spell slots/resources) with defaults.
Unit tests for mapping completeness (no missing refs).
Intent Parsing Upgrade
Replace regex-only parsing with structured intents: castAbility, attack, checkSheet, move, look, etc.
Match against ability names/aliases from reference; return target names when present.
Tests: text → intent fixtures.
Accountant Resolution with 5e Data
In _updateGameState, branch on intent; for castAbility, enforce class/level requirements, apply damage/healing/conditions per JSON, update HP/resources deterministically.
Use reference data for attack damage when weapon specified.
Emit factual eventSummary and log entry only; no Narrator influence on mechanics.
Tests: deterministic resolution for key abilities and rejection paths.
Check Sheets & Lists
Implement factual summaries for “check skills/abilities/inventory” using reference data and GameState.
Skip Narrator or add optional safe flavor line.
Narrator Guardrails
Update system prompt to forbid listing skills/abilities/inventory/numbers; keep 1-line flavor only.
Preserve fallback to omit flavor if unsafe.
UI/UX
Ensure fact+flavor display uses new log entries; add lightweight indicators for intent type/mode if useful.
Backfill old saves’ narrativeHistory into log on hydrate (migration helper).