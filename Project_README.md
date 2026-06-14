# Dungeon Portal

Deterministic, text-first dungeon crawler built on Next.js with Supabase auth/leaderboard (optional), localStorage saves, and PHB/DMG-grounded rules.

## Features
- Quick-start archetypes (Fighter/Rogue/Cleric/Wizard) with class gear/bonuses, XP/level progression, and easy starter mobs.
- Deterministic combat/state resolution; narrator bound to resolved rolls, PHB actions/conditions, and DMG style.
- Sidebar path mini-map, class/XP display, inventory and threats, plus cached scene art (with variant pooling).
- LocalStorage save/load with hydration/backfill; optional Supabase leaderboard; neutral starts to avoid surprise damage.

## Getting Started
1) Install deps: `npm install`
2) Env: copy `.env.local.example` to `.env.local` and fill:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
3) (Optional) Supabase table for leaderboards: `leaderboard_entries` (see `lib/supabase/leaderboard.ts` for fields).
4) Run dev: `npm run dev` (visit http://localhost:3000)

## Content References
- PHB/DMG sources: `docs/DM-rules.md` (PDFs are not tracked in this repo).
- Curated snippets: `data/5e/*` (abilities, skills, actions, conditions, weapons, armor).
- Scene images: curated assets in `public/scene-cache` per scene key (optional variants via `_v0/_v1/_v2`).

## Repo Notes
- Core logic/actions: `app/actions.ts`
- UI: `app/page.tsx`, `components/GameSidebar.tsx`
- Schemas: `lib/game-schema.ts`
- Rules refs: `lib/refs.ts`
