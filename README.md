# Dungeon Portal

AI-driven, text-first dungeon crawler built on Next.js with Supabase saves, Groq models for logic/narration, and PHB/DMG-grounded rules.

## Features
- Quick-start archetypes (Fighter/Rogue/Cleric/Wizard) with class gear/bonuses and XP/level progression.
- Deterministic combat/state resolution; narrator bound to resolved rolls, PHB actions/conditions, and DMG style.
- Sidebar path mini-map, class/XP display, inventory and threats, plus cached scene art (with variant pooling).
- Supabase-backed save/load; hydration/backfill; neutral starts and easy starter mobs.

## Setup
1) Install deps: `npm install`
2) Env: copy `.env.local.example` to `.env.local` and fill:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GROQ_API_KEY=...
```
3) Run dev: `npm run dev`

## Notes
- PHB/DMG references: see `public/D&D 5e - Players Handbook.pdf` and `DM-rules.md`. Curated snippets in `data/5e/*`.
- Scene cache: images saved under `public/scene-cache` per scene key with small variant pool.
- Saved games table requires unique constraint on `user_id`.
