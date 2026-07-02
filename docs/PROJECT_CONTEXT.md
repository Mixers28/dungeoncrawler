# Project Context - Long-Term Memory

> Canonical architecture and project context for humans and agents. Keep this file stable and factual; put short-term priorities in `docs/NOW.md`.

<!-- SUMMARY_START -->
**Summary:**
- Dungeon Portal is a text-first Next.js dungeon crawler with deterministic server-side game resolution and canned flavor narration.
- Auth uses Auth.js credentials backed by the local `public.users` table.
- Saves are persisted in Postgres through Drizzle (`saved_games.game_state` JSONB), then hydrated through Zod before use.
- Story content lives in `story/*.json`; rules/reference content lives in `data/5e/*.json`.
- Deployment target is Railway with Postgres, `DATABASE_URL`, `AUTH_SECRET`, and Drizzle migrations.
<!-- SUMMARY_END -->

## Documentation Map

- Entry point and setup: `README.md`
- Project overview: `Project_README.md`
- Canonical architecture/context: `docs/PROJECT_CONTEXT.md`
- Current build order and active sprint: `docs/NOW.md`
- Roadmap: `docs/phased-plan.md`
- Release validation: `docs/deploy-checklist.md`
- Manual/automated smoke checks: `SMOKE.md`
- Historical or supplemental docs: files that explicitly say deprecated, superseded, or supplemental.

## Project Overview

- **Name:** Dungeon Portal
- **Purpose:** Text-first dungeon crawler with deterministic mechanics, JSON-authored story content, and factual state logs.
- **Primary stack:** Next.js App Router, TypeScript, React, Tailwind CSS, Auth.js, Drizzle ORM, Postgres.
- **Deployment target:** Railway.
- **Local database:** Docker Compose Postgres on port `5433`.

## Core Design Pillars

- Game state is authoritative and deterministic. Narration decorates resolved facts but does not invent mechanics.
- Server actions load saves from the database and persist validated state; client state is never trusted as the source of truth.
- Story scenes, exits, spawns, discoveries, and rewards should be data-driven through `story/*.json`.
- Rules and equipment should come from typed local reference data in `data/5e/*.json`.
- Documentation remains plain Markdown and should point to one canonical source for each concern.

## Current Architecture

- `app/actions.ts` authenticates the user, loads the save, parses intent, runs the game engine, and persists the new state.
- `auth.ts` configures Auth.js credentials auth against `lib/db/schema.ts` `users`.
- `lib/db/schema.ts` defines `users` and `saved_games`; committed migrations live in `drizzle/`.
- `lib/game/state.ts` builds and hydrates `GameState`, including legacy backfills and derived scene/room registries.
- `lib/game/engine/index.ts` resolves turns: movement, combat, spells, inventory, stunts, loot, XP, quests, and scene completion.
- `lib/5e/reference.ts`, `lib/5e/classes.ts`, and `lib/5e/intents.ts` expose typed 5e data and intent parsing.
- `lib/leaderboard.ts` is currently localStorage-only. The old Supabase global leaderboard SQL is archived in `supabase/migrations/`.

## Setup Contract

Required local setup:

```bash
npm install
docker compose up -d
cp .env.local.example .env.local
npm run db:migrate
npm run dev
```

Required environment:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dungeoncrawler
AUTH_SECRET=<generate with: openssl rand -base64 32>
```

Validation commands:

```bash
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
```

`npm run test:e2e` requires local Postgres and a valid `.env.local`.

## Non-Goals And Historical Paths

- Supabase Auth is not the active auth path.
- Supabase `auth.users` migrations are not part of the active setup path.
- Gameplay saves are not localStorage-backed. The leaderboard remains localStorage-only until a new global leaderboard design is implemented.
- Model-generated mechanics are out of scope for core resolution; mechanics should be deterministic and data-driven.

## Decision Log

- 2026-07-02 - Standardized runtime persistence on Auth.js credentials plus Drizzle/Postgres. Supabase SQL retained only as legacy reference.
- 2026-07-02 - Added first-class inventory equip/drop handling and owned-weapon validation in the game engine.
- 2026-07-02 - Removed `next/font/google` to keep production builds independent of Google Fonts network fetches.
