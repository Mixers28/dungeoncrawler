# Dungeon Portal (dcv01)

Branch `dcv01` focuses on hybrid facts+flavor, deterministic mechanics, a prefab story graph, and 5e reference data wiring for Dungeon Portal.

## What’s in this branch
- Facts-first logs: Accountant writes `LogEntry.summary`; Narrator adds at most one short flavor line with strict bans on numbers/items/skills.
- Structured intents: user text parsed into attack/defend/run/look/check-sheet/cast-ability, with class weapon proficiencies applied; quick-insert buttons for spells/skills/weapons in the sidebar.
- 5e reference layer: typed loaders for weapons, armor, skills, basic actions, conditions, wizard spell list (`data/5e/spells-wizard.json`), and a starter wizard prefab (`data/5e/char_wizard_novice.json`).
- Story graph: scenes loaded from `story/*.json` with gated exits, spawns, and rewards; narrator modes expanded but flavor stays on a leash.
- GameState backfill: skills/logs/story/spell fields hydrate so older saves keep working.

## Run
1) Install: `npm install`
2) Env: set Supabase + Groq keys in `.env.local` (see `Project_README.md` for details).
3) Dev server: `npm run dev` then open http://localhost:3000.

## Quick checks
- `check skills` → factual summary of skills/equipped gear (no Narrator).
- `attack the rat with longsword` → uses 5e weapon dice and notes weapon in facts.
- `cast magic missile on <target>` → resolves starter spell set; leveled spells consume slots; unknown/unprepared spells reject.
- `look around` → factual scan of threats plus optional flavor; repeated scans collapse to “nothing changed.”
See `SMOKE.md` for a fuller manual runbook.

## Docs & references
- Branch notes: `DOcs/dcv01-notes.md`
- Flavor/Narrator task context: `Flavor.md`
- 5e data: `data/5e/*.json` (including wizard spells)
- Original overview: `Project_README.md`
