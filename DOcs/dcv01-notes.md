# dcv01 Branch Notes

## Scope
- Hybrid facts+flavor flow: Accountant produces deterministic summaries; Narrator adds at most one short sentence with strict bans on numbers/items/skills/abilities.
- Structured intents: attack/defend/run/look/check-sheet/cast-ability parsing drives combat and sheet outputs; unproficient weapons fall back to fists.
- 5e reference layer: typed loaders for weapons, armor, skills, basic actions, conditions, and wizard spells (`data/5e/spells-wizard.json`).
- State backfill: skills and logs hydrate with sensible defaults; old `narrativeHistory` migrates into `log`.
- Starter wizard prefab (`data/5e/char_wizard_novice.json`) seeds skills, inventory, known/prepared spells, and slots; spellcasting now resolves a starter set (Magic Missile, Thunderwave, Fire Bolt, Ray of Frost, Shield, Mage Armor, Detect Magic, Identify).
- UI: sidebar spellbook/backpack collapsible; quick-insert buttons for spells (cast), skills (use), and weapons (attack with); spellbook hides for non-casters.
- Story graph: scenes loaded from `story/*.json` with entry conditions, exits, spawns, and rewards; story state tracked (`storySceneId`, `storyFlags`); basic transitions and rewards wired in Accountant.

## Current behaviors
- `check skills` → factual skills + equipped weapon/armor; no Narrator.
- `attack ...` → weapon dice from 5e data; facts include weapon name.
- `cast <starter spell>` → resolved mechanics for the starter set; slots enforced for levelled spells; unknown/unprepared spells rejected.
- `look around` → factual location/threat scan plus optional flavor line.
- Sidebar quick actions insert commands into the input; clipboard fallback for spells if no handler.
- Story exits: actions matching scene exit verbs move you to the next scene (if threats are cleared and required items present); onEnter spawns from scene JSON; onComplete sets flags and awards XP.

## Known gaps
- Lint warnings remain in eslint config and Supabase server helpers (unused identifiers) — intentionally left.
- Older modified files in the branch are untouched; see `git status` before merging.
- Spell resolution covers only the starter set; higher-level spells are unmodeled.
- Active effect durations (Shield, Mage Armor) are simplified; no per-turn expiry.
- Story scenes are loaded but story JSON files are not tracked in Git yet; ensure they’re bundled/persisted.

## Quick smoke
- See `SMOKE.md` for manual steps.
- Key commands: `npm install`, `npm run dev`, then issue `check skills`, `attack the rat with longsword`, `cast fireball on rat`, `look around` in the UI.
