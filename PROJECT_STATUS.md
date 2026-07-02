# Project Status

> Legacy status file. Do not use this as the source of truth for current architecture or build order.

Use these docs instead:

- Current architecture/context: `docs/PROJECT_CONTEXT.md`
- Current build order: `docs/NOW.md`
- Roadmap: `docs/phased-plan.md`
- Setup: `README.md`
- Smoke validation: `SMOKE.md`
- Release validation: `docs/deploy-checklist.md`

## Current Snapshot

- Runtime stack: Next.js App Router, TypeScript, Tailwind CSS, Auth.js credentials, Drizzle ORM, Postgres.
- Auth table: `public.users` from `lib/db/schema.ts`.
- Save table: `public.saved_games` with JSONB `game_state`, hydrated through Zod.
- Story content: `story/*.json`.
- Rules/reference data: `data/5e/*.json`.
- Active validation commands: `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e`.

Older status entries in git history may mention Supabase Auth, Supabase sessions, or localStorage saves. Those paths are superseded by the current Auth.js plus Drizzle/Postgres architecture.
