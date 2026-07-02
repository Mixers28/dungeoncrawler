# Dungeon Portal

Deterministic, text-first dungeon crawler built on Next.js with Auth.js credentials, Drizzle/Postgres saves, and PHB/DMG-grounded rules.

## Features
- Quick-start archetypes (Fighter/Rogue/Cleric/Wizard) with class gear/bonuses, XP/level progression, and easy starter mobs.
- Deterministic combat/state resolution; narrator bound to resolved rolls, PHB actions/conditions, and DMG style.
- Sidebar path mini-map, class/XP display, inventory and threats, plus cached scene art (with variant pooling).
- Database-backed save/load with hydration/backfill; neutral starts to avoid surprise damage.

## Getting Started
1) Install deps: `npm install`
2) Start Postgres:
```
docker compose up -d
```
3) Env: copy `.env.local.example` to `.env.local` and fill:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dungeoncrawler
AUTH_SECRET=<generate with: openssl rand -base64 32>
```
4) Apply database migrations:
```
npm run db:migrate
```
5) Run dev: `npm run dev` (visit http://localhost:3000)

## Content References
- PHB/DMG sources: `docs/DM-rules.md` (PDFs are not tracked in this repo).
- Curated snippets: `data/5e/*` (abilities, skills, actions, conditions, weapons, armor).
- Scene images: curated assets in `public/scene-cache` per scene key (optional variants via `_v0/_v1/_v2`).

## Repo Notes
- Core logic/actions: `app/actions.ts`
- UI: `app/page.tsx`, `components/GameSidebar.tsx`
- Schemas: `lib/game-schema.ts`
- Database schema: `lib/db/schema.ts`, migrations in `drizzle/`
- Rules refs: `lib/refs.ts`
