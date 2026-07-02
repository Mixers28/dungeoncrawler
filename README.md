# Dungeon Portal (dcv01)

Branch `dcv01` focuses on hybrid facts+flavor, deterministic mechanics, a prefab story graph, and 5e reference data wiring for Dungeon Portal.

## What's in this branch
- Facts-first logs: Accountant writes `LogEntry.summary`; optional canned flavor line pulled from `data/narration/*.json`.
- Structured intents: user text parsed into attack/defend/run/look/check-sheet/cast-ability, with class weapon proficiencies applied; quick-insert buttons for spells/skills/weapons in the sidebar; input auto-refocuses.
- 5e reference layer: typed loaders for weapons, armor, skills, basic actions, conditions, wizard + cleric spell lists (`data/5e/spells-wizard.json`, `data/5e/spells-cleric.json`), and starter prefabs in `data/5e/char_*.json`.
- Story graph: scenes loaded from `story/*.json` with gated exits, spawns, rewards (XP + loot tables), and location history; narrator modes expanded but flavor stays on a leash.
- Combat/spells: wizard and cleric spells recognized with slots/prepared checks; basic effects for key spells (damage, heals, AC buffs, pins); bandages added as a starter heal.
- UI: sidebar includes a dice tray that surfaces last resolved attack/damage rolls, plus a header image fallback when a cached scene image is missing.
- Loot: scene rewards and corpse looting roll from `data/5e/loot/*.json`, with monster→table mapping and coin/item drops.
- GameState backfill: skills/logs/story/spell fields hydrate so older saves keep working.

## Run
1) Install: `npm install`
2) Start Postgres: `docker compose up -d`
3) Env: copy `.env.local.example` to `.env.local`, then set `DATABASE_URL` and `AUTH_SECRET`.
4) Apply migrations: `npm run db:migrate`
5) Dev server: `npm run dev` then open http://localhost:3000.

## Quick checks
- `check skills` → factual summary of skills/equipped gear (no Narrator).
- `attack the rat with longsword` → uses 5e weapon dice and notes weapon in facts.
- `cast magic missile on <target>` / `cast healing word` / `use bandage` → resolves spells/consumables; leveled spells consume slots; unknown/unprepared reject.
- `look around` → factual scan of threats plus exits; repeated scans collapse to “nothing changed.”
See `SMOKE.md` for a fuller manual runbook.

## Docs & references
- Architecture/context source of truth: `docs/PROJECT_CONTEXT.md`
- Current build order: `docs/NOW.md`
- Roadmap: `docs/phased-plan.md`
- Smoke validation: `SMOKE.md`
- Deploy validation: `docs/deploy-checklist.md`
- Flavor lines: `data/narration/*.json`
- 5e data: `data/5e/*.json` (weapons/armor/skills/spells; loot tables in `data/5e/loot`)
- Original overview: `Project_README.md`

## Next/Planned
See `docs/NOW.md` for immediate build order and `docs/phased-plan.md` for roadmap items.
