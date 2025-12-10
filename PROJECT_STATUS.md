# Dungeon Portal – Status

## Current Setup
- Next.js 14 App Router with Tailwind styling (`app/`), Supabase auth/session middleware (`middleware.ts`, `utils/supabase/*`).
- AI-backed game logic and narration in `app/actions.ts` using Groq-hosted models; game schema/types in `lib/`.
- Client gameplay UI in `app/page.tsx` with sidebar component `components/GameSidebar.tsx`; login flow at `app/login/page.tsx`.

## Changes Made (this pass)
- Fixed combat damage rolls with a dice parser that supports modifiers and multiple dice terms (`app/actions.ts`).
- Added saved-game hydration/validation to backfill defaults and rebuild derived fields like images/room registry when loading existing saves (`app/actions.ts`).
- Hardened Supabase persistence: upserts now check and surface errors during create, turn processing, and reset flows (`app/actions.ts`).
- Persisted resolved dice rolls (player/monster attack and damage) into game state for auditing or future UI (`app/actions.ts`, `lib/game-schema.ts`).
- Clamped story act to defined acts, and fed the narrator the current act, room description, and inventory to reduce hallucinations and keep plot/location anchored (`app/actions.ts`).

## Future Plans
- Add automated tests for dice parsing and state hydration to catch regressions.
- Build a migration helper/CLI to scan and repair legacy saves before load.
- Persist and display recent combat/narrative logs client-side for transparency and debugging.
