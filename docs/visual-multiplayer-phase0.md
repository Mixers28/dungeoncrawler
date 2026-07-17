---
name: visual-multiplayer-phase0
description: Phase 0 plan for an Eye-of-the-Beholder-inspired visual multiplayer interface and asset pipeline
---

# Visual Multiplayer Phase 0

> Status: functionally complete baseline. This remains the reference for the
> visual shell, screen model, asset manifest conventions, and visual-first
> multiplayer UI direction. It complements `docs/multiplayer-design.md`, which
> covers the session/state architecture.

## Goal

Move Dungeon Portal from a text-first command UI toward a visual-first, party-based dungeon crawler interface that is easier to operate in multiplayer.

The target is inspired by classic first-person grid dungeon crawlers such as Eye of the Beholder:

- One shared dungeon viewport dominates the screen.
- Party state is always visible but compact.
- Movement and combat are button-driven.
- Text becomes a short factual event receipt, not the primary play surface.
- Multiplayer state can map cleanly onto a shared party location plus per-player character slots.

This is not a clone. The goal is to use the proven screen grammar: first-person view, grid movement, party/status rail, compact action controls, and a small log.

## Why This Comes Before Multiplayer Code

The current UI is overloaded for co-op:

- Left sidebar: location art, stats, quests, path, inventory.
- Right sidebar: dice, skills, weapons, spells, threats.
- Center: chat transcript, command hints, input, visual combat mode.
- Visual mode only takes over during combat.

Multiplayer would add party members, turn ownership, presence, session controls, and actor-named logs. Adding that on top of the current layout would make the interface harder to reason about. Phase 0 defines the simpler target first, then the multiplayer architecture can build toward it.

## Screen Model

Desktop layout:

```text
+------------------------------------------------------------------+
| Party rail        | Dungeon viewport                  | Context  |
|                   |                                   | drawer   |
| P1 HP AC status   | First-person room/corridor art     | optional |
| P2 HP AC status   | Monsters/items/doors overlaid      | details  |
| P3 HP AC status   | Direction and interaction afford.  |          |
| P4 HP AC status   |                                   |          |
+-------------------+-----------------------------------+----------+
| Movement cluster  | Action tray                        | Log strip |
+-------------------+-----------------------------------+----------+
```

Mobile layout:

- Viewport first.
- Party rail collapses to a horizontal strip.
- Movement cluster and action tray sit below the viewport.
- Inventory, spellbook, map, and quest details open as drawers.
- Log strip is collapsed by default and expands when tapped.

## Mount Strategy

Do not create a separate gameplay route for Phase 0. Keep `/` as the gameplay route because it already owns auth/save hydration, restart, death handling, and server action calls.

Frontend shell placement:

- Claude Code owns `components/visual/VisualDungeonShell.tsx` and its subcomponents.
- `app/page.tsx` should only delegate to the shell when visual mode is active.
- Text mode remains as a fallback until visual-mode smoke coverage is green.
- Visual mode should eventually cover exploration and combat, not combat only.

Backend contract placement:

- Codex owns `lib/visual/view-model.ts`.
- Codex exposes `buildVisualGameViewModel(state: GameState): VisualGameViewModel`.
- Claude Code should render movement/action controls from that view model rather than duplicating story exit or combat availability rules in components.

## Primary Controls

Movement:

- Forward.
- Back.
- Turn left.
- Turn right.
- Optional strafe left/right after the basic loop is stable.

Exploration actions:

- Search.
- Interact.
- Open/use.
- Rest, once rest mechanics exist.
- Map/directions drawer.

Combat actions:

- Attack.
- Cast.
- Use item.
- Defend.
- Flee.
- Target selection by clicking a visible monster or cycling targets.

Free text:

- Keep an advanced command input behind a drawer or shortcut.
- Do not remove text parsing; demote it from the main interaction path.

## Multiplayer Interaction Rules

Use the existing `docs/multiplayer-design.md` async co-op model, with these UI-specific rules:

- The party has one shared location and viewport.
- Each player owns one character slot in the party rail.
- In exploration, any player may propose a move or interaction.
- For v1, movement executes immediately if there are no alive threats.
- In combat, only the active player can use combat actions.
- Non-active players can inspect, open inventory/spells, and view the log, but cannot resolve turns.
- The active player's slot is highlighted in the party rail.
- Log entries show actor name and facts: "Ana hits Skeleton with Mace for 5 damage."

Deferred rules:

- Party vote movement.
- Party splitting.
- Spectator mode.
- Live presence indicators beyond simple last-seen state.
- Player trading UI.

## State Mapping

Shared session state drives:

- Viewport scene image.
- Current location.
- Available exits and movement affordances.
- Story flags and quest objectives.
- Visible monsters and their HP/status.
- Party log.
- Round/turn ownership.

Character state drives:

- Party slot HP, AC, class, conditions.
- Personal inventory.
- Personal spell slots and prepared spells.
- Personal last rolls.
- Active effects on that character.

The single-player prototype should use the existing `GameState` shape and adapt later to `SessionState + CharacterState`.

Reserved multiplayer-compatible field names for Phase 0 UI contracts:

```ts
type VisualPartySlot = {
  playerId: string;
  displayName: string;
  className: string;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  isYou: boolean;
  isActiveTurn: boolean;
  portraitAssetId?: string;
};

type VisualTurnState = {
  mode: 'solo' | 'exploration' | 'combat';
  currentTurnPlayerId: string | null;
  canAct: boolean;
  reason?: string;
};
```

For solo Phase 0, `partySlots` should contain one slot derived from `GameState`, `playerId` should be stable as `"solo"`, `isYou` should be `true`, and `currentTurnPlayerId` should be `"solo"` when an action is available. These fields map directly to the multiplayer `currentTurnPlayerId` and actor-named log plan later.

## Asset Pipeline

Assets should be generated and cached before they are required by the UI. Runtime gameplay should load local assets, not wait for generation.

Asset classes:

- Scene backdrops: first-person room/corridor images, 16:9 and 4:3 crops.
- Door states: closed, open, locked, barred, glowing, boss-gated.
- Monster standees: transparent-background or consistent dark matte cutouts.
- Item icons: inventory and loot, square transparent PNGs.
- Character portraits: class portraits, square crops.
- UI frame pieces: restrained stone/iron panels, dividers, slot frames.
- Status icons: conditions, buffs, debuffs, turn state.

Recommended local paths:

- `public/visual/scenes/<scene-id>_<variant>.png`
- `public/visual/monsters/<monster-id>.png`
- `public/visual/items/<item-id>.png`
- `public/visual/portraits/<class-id>.png`
- `public/visual/ui/<asset-name>.png`
- `data/visual/asset-manifest.json`

Manifest fields:

```json
{
  "id": "future_courtyard_hub_v1",
  "kind": "scene",
  "path": "/visual/scenes/future_courtyard_hub_v1_0.png",
  "styleVersion": "visual-phase0-v1",
  "prompt": "first-person dungeon courtyard...",
  "source": "generated",
  "width": 1536,
  "height": 864
}
```

## Generation Style Guide

Scene prompts:

- First-person fantasy dungeon crawler view.
- Player stands at grid-cell center, looking straight ahead.
- Clear readable exits and interactable objects.
- No text, logos, UI, captions, or characters in the foreground unless requested.
- Consistent torchlit stone/iron citadel mood.
- High contrast around doors, monsters, loot, and interactables.

Monster prompts:

- Full-body fantasy creature, front-facing or three-quarter view.
- Transparent background or flat neutral dark background.
- Readable silhouette at small size.
- No gore emphasis.
- Match existing 5e-style monster identity without copying protected art.

Item prompts:

- Single object icon, centered.
- Transparent background.
- Readable at 48px.
- Consistent lighting and perspective.

Portrait prompts:

- Bust portrait of a fantasy adventurer class.
- Neutral expression, readable class gear.
- Consistent painted style and lighting.
- No text.

## Phase 0 Deliverables

1. Visual shell spec.
   - Lock the layout, controls, responsive behavior, and drawer model.

2. Asset manifest schema.
   - Define `data/visual/asset-manifest.json`.
   - Define fallback rules for missing assets.

3. Single-player visual shell prototype.
   - New component wraps existing `GameState`.
   - Replaces the current overloaded in-run layout behind a feature flag or view mode.
   - Supports movement buttons, action tray, compact party slot, viewport, and compact log.

4. Asset seed set.
   - Generate or reuse enough local assets for Act 1: gate, hub, three branches, side rooms, boss, treasury, key items, starter monsters, and four class portraits.

5. Multiplayer readiness review.
   - Confirm the shell can represent 2-4 party slots, turn ownership, locked controls, and actor-named logs before starting the DB/session split.

## Acceptance Criteria

- A solo player can complete the existing smoke path without using the text input.
- The first viewport shows the dungeon image, current location, party slot, movement controls, and action tray without sidebars.
- Combat target/action flow works through buttons.
- Inventory and spellbook are drawers, not persistent sidebars.
- Log is compact and factual, with the last few entries visible.
- Missing assets fall back gracefully.
- The same layout can display four party members without major restructuring.
- `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm run test:e2e` stay green.

## Implementation Order

1. Add asset manifest types and loader helpers.
2. Add `buildVisualGameViewModel(state)` with party slot, turn state, movement command, action availability, log, and asset references.
3. Add `VisualDungeonShell` using the view model and current `GameState`.
4. Move existing quick actions into a compact action tray.
5. Add movement buttons mapped to view-model commands.
6. Replace persistent sidebars with drawers in visual mode.
7. Add class/monster/item asset placeholders and fallback loading.
8. Expand e2e to cover visual-mode smoke.
9. Begin multiplayer M1 state split from `docs/multiplayer-design.md`.

## Risks

- Asset inconsistency can make the UI feel stitched together. Mitigate with one style version and a manifest.
- Visual movement can expose weak story graph direction data. Mitigate by adding directional metadata to exits during the shell prototype.
- Multiplayer controls can become confusing if exploration actions are fully free-form. Mitigate with clear active-player state and a compact log.
- Replacing the UI before stabilizing controls could break the e2e smoke. Mitigate with a feature flag until visual-mode smoke passes.
