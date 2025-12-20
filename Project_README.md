# Dungeon Portal

AI-driven, text-first dungeon crawler built on Next.js with Supabase saves, Groq models for logic/narration, and PHB/DMG-grounded rules.

## Features
- Quick-start archetypes (Fighter/Rogue/Cleric/Wizard) with class gear/bonuses, XP/level progression, and easy starter mobs.
- Deterministic combat/state resolution; narrator bound to resolved rolls, PHB actions/conditions, and DMG style.
- Sidebar path mini-map, class/XP display, inventory and threats, plus cached scene art (with variant pooling).
- Supabase-backed save/load with hydration/backfill; neutral starts to avoid surprise damage.

## Getting Started
1) Install deps: `npm install`
2) Env: copy `.env.local.example` to `.env.local` and fill:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GROQ_API_KEY=...
```
3) Supabase table: `saved_games` with a unique constraint on `user_id` (FK to `auth.users`).
4) Run dev: `npm run dev` (visit http://localhost:3000)

## Content References
- PHB/DMG sources: `docs/D&D 5e - Players Handbook.pdf`, `docs/Dungeon Master's Guide.pdf`, and `docs/DM-rules.md`.
- Curated snippets: `data/5e/*` (abilities, skills, actions, conditions, weapons, armor).
- Image cache: `public/scene-cache` per scene key with 3 variants.

## Repo Notes
- Core logic/actions: `app/actions.ts`
- UI: `app/page.tsx`, `components/GameSidebar.tsx`
- Schemas: `lib/game-schema.ts`
- Rules refs: `lib/refs.ts`
