---
name: story-progression-roadmap
description: Phased roadmap for branching story progression and procedural routes
---

# Plan

Create a two-phase roadmap for story progression: Phase 1 delivers authored branching scenes for immediate player choice; Phase 2 upgrades to procedural junctions and route modules for long-term replayability.

## Phase 1 — Authored branching scenes (quick win)

### Goal
Introduce real player choice with 3 mid‑branches, key‑gated side paths, and seeded variants while keeping the existing story scene system.

### Scope
- In: new `story/*.json` scenes, branch exits, key/map/sigil gating, variant groups.
- Out: world graph and procedural route generation.

### Story graph (Act 1)

**Hub**
- `future_courtyard_hub_v1` / `future_courtyard_hub_v2`
  - Exits to three branches: hallway, shrine, cellar.

**Branch A: Hallway**
- `future_hallway_branch_v1` / `future_hallway_branch_v2`
- Optional side: `future_armory_side_v1` / `future_armory_side_v2` (requires Armory Key)

**Branch B: Shrine**
- `future_shrine_branch_v1` / `future_shrine_branch_v2`
- Optional side: `future_sanctum_side_v1` / `future_sanctum_side_v2` (requires Sanctum Sigil)

**Branch C: Cellar**
- `future_cellar_branch_v1` / `future_cellar_branch_v2`
- Optional side: `future_cache_side_v1` / `future_cache_side_v2` (requires Hidden Map)

**Converge**
- `future_bossroom_v1` / `future_bossroom_v2` (requires all three branches cleared)

**End**
- `future_treasury_v1` / `future_treasury_v2`

### Gating loop
- Hidden Map (armory) → Cache
- Sanctum Sigil (cache) → Sanctum
- Armory Key (sanctum) → Armory

### Action items
[ ] Wire exit gating for `entryConditions` and `consumeItem` in the engine.
[ ] Add seed + visit index selection for `future_*` group variants.
[ ] Add discovery chances for keys/maps via search/investigate rewards.
[ ] Wire Act 1 entry to the new hub scenes and convergence conditions.

### Validation
- Manual: hub offers 3 distinct exits.
- Manual: keys/maps gate optional areas correctly.
- Manual: boss unlocks after all three branches cleared.
- Manual: different seeds yield different variants with the same arc.

---

## Phase 2 — Junctions + route modules (future goal)

### Goal
Replace linear inter‑anchor travel with deterministic procedural micro‑maps generated from route modules, while preserving anchor beats.

### Scope
- In: world graph, route modules, segment generator, junction navigation.
- Out: replacing existing anchor story beats.

### Data model additions
- `runSeed: number`
- `worldGraph: { nodes, edges }`
- `currentNodeId: string`
- `segments: Record<segmentId, segment>`

### Route modules
- `data/routes/*.json` (sewer, ramparts, barracks)
- Each module defines room counts, loops, side rooms, gates, encounters, loot weights.

### Engine additions
- Seeded RNG utilities (`lib/game/rng.ts`)
- Segment generator (`lib/game/worldgen/segment.ts`)
- Movement handler that supports `chooseExit` intents.

### Action items
[ ] Add route modules under `data/routes/` with encounter + loot tables.
[ ] Implement deterministic segment generation and persistence.
[ ] Add `chooseExit` intent parsing and UI hooks.
[ ] Expose junction exits with risk/reward tags.

### Validation
- Manual: junction offers 2–4 exits with labels.
- Manual: generated segment includes loop + side room + gate.
- Manual: same runSeed yields same segment layout.

## Risks and edge cases
- Over‑gating can stall progress; ensure at least one ungated route exists.
- Verb overlap can cause accidental navigation; keep verbs distinct per branch.
- Randomization should not block mandatory progression.
