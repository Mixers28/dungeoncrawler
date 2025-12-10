# dcv01 Branch Notes

## Scope
- Hybrid facts+flavor flow: Accountant produces deterministic summaries; Narrator adds at most one short sentence with strict bans on numbers/items/skills/abilities.
- Structured intents: attack/defend/run/look/check-sheet/cast-ability parsing drives combat and sheet outputs; unproficient weapons fall back to fists.
- 5e reference layer: typed loaders for weapons, armor, skills, basic actions, conditions, and wizard spells (`data/5e/spells-wizard.json`).
- State backfill: skills and logs hydrate with sensible defaults; old `narrativeHistory` migrates into `log`.

## Current behaviors
- `check skills` → factual skills + equipped weapon/armor; no Narrator.
- `attack ...` → weapon dice from 5e data; facts include weapon name.
- `cast <spell>` → spells dataset is present but mechanics are not yet wired; returns a deterministic attempt message.
- `look around` → factual location/threat scan plus optional flavor line.

## Known gaps
- Spell/ability resolution is stubbed; casting does not change HP/resources yet.
- Lint warnings remain in eslint config and Supabase server helpers (unused identifiers).
- Older modified files in the branch are untouched; see `git status` before merging.

## Quick smoke
- See `SMOKE.md` for manual steps.
- Key commands: `npm install`, `npm run dev`, then issue `check skills`, `attack the rat with longsword`, `cast fireball on rat`, `look around` in the UI.
