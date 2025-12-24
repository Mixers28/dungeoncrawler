# Sprint Backlog

## Sprint 1: Stability + UX
1) Potion use works  
- As a player, I can drink a healing potion and regain HP.  
- Acceptance: “drink/use/take healing potion” reduces inventory count and increases HP; summary mentions healed amount; no-op when none available.

2) Dice Tray shows spell rolls  
- As a caster, I can see spell attack or save rolls in Dice Tray.  
- Acceptance: After Fire Bolt or Sacred Flame, Dice Tray renders and shows attack roll or save vs DC.

3) Weapon name normalization  
- As a player, I can use “Rusted Short Sword” and it resolves to Shortsword stats.  
- Acceptance: Looting/attacking with variants maps to canonical SRD names; no missing weapon lookups.

4) Split sidebar polish  
- As a player, I can clearly view stats/inventory (left) and spells/targets/dice (right).  
- Acceptance: Desktop shows two panels; mobile drawers open independently; no overlap/hidden content.

5) Login flow correctness  
- As a user, I see login first, then character selection.  
- Acceptance: `/` redirects to splash when unauthenticated; after login, user sees character selection without loops.

## Sprint 2: Mechanics + Story
1) Consumable quick-use UI  
- As a player, I can click consumables in sidebar to use them.  
- Acceptance: Items show “Use” actions; uses apply effects and update inventory.

2) Expanded spell mechanics  
- As a caster, spells apply listed effects (buffs/conditions/AoE) consistently.  
- Acceptance: At least 5 spells apply non-damage effects; effects reflected in state and summary.

3) Story gating polish  
- As a player, story exits respect gates and show clear locked reasons.  
- Acceptance: Gate failures show explicit reason; unlock updates story flags.

4) Quest guidance  
- As a player, I can see current quest objectives.  
- Acceptance: Sidebar shows active quests; logs update on quest progress.

## Sprint 3: QA + Ops
1) Automated smoke test  
- As a developer, I can run a smoke test for login/start/core actions.  
- Acceptance: Playwright test passes for login/start/check skills/attack/loot.

2) Save migration helper  
- As a developer, I can migrate legacy saves to current schema.  
- Acceptance: CLI/report identifies missing fields and applies defaults safely.

3) Deploy checklist  
- As a release owner, I can follow a deploy validation checklist.  
- Acceptance: Checklist covers build, login flow, combat/dice, story navigation.

## Coder Tip: docs/ vs docs/ normalization
- Audit and standardize references to `docs/` vs `docs/`.
- If consolidating to `docs/`, update references in `README.md`, `Project_README.md`, `PROJECT_STATUS.md`, `SMOKE.md`, and any `docs/*.md` backlinks.
