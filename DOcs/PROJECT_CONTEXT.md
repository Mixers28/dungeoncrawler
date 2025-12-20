# Project Context – Long-Term Memory (LTM)

> High-level design, tech decisions, constraints for this project.  
> This is the **source of truth** for agents and humans.

<!-- SUMMARY_START -->
**Summary (auto-maintained by Agent):**
- Dungeon Portal is a Next.js dungeon crawler with Supabase auth/saves and Groq-backed narration.
- Story content lives in `story/*.json` and game state stays deterministic on the server.
- Deployment target is Railway, driven from a tracked git branch.
- Core game logic has been modularized under `lib/game/` with economy/progression and canned narration systems.
<!-- SUMMARY_END -->

---

## 1. Project Overview

- **Name:** Dungeon Portal
- **Owner:** TBD
- **Purpose:** AI-assisted, text-first dungeon crawler with deterministic mechanics and Supabase persistence.
- **Primary Stack:** Next.js (App Router), TypeScript, Supabase, Tailwind CSS, Groq API.
- **Target Platforms:** Web (desktop/mobile), Railway deployment target.

---

## 2. Core Design Pillars

- Keep deterministic game state authoritative; narration decorates but does not mutate state.
- Keep story content in JSON so scenes/exits/rewards are data-driven.
- Keep auth and saves handled by Supabase with server-side actions.

---

## 3. Technical Decisions & Constraints

- Language(s): TypeScript/React for app; Markdown for docs.
- Framework(s): Next.js App Router; Tailwind CSS.
- Database / storage: Supabase (auth + `saved_games` table).
- Hosting / deployment: Railway, pulling from a git branch.
- Non-negotiable constraints:
  - Must remain backend-free and editor-native.
  - Documentation stays in plain Markdown for easy review.

---

## 4. Architecture Snapshot

- App lives in `app/` with server actions handling core game logic.
- Story scenes load from `story/*.json` with deterministic picks by seed.
- Supabase middleware handles sessions; saves are upserted per user.

---

## 5. Links & Related Docs

- Roadmap: TBD
- Design docs: `PROJECT_STATUS.md`, `SMOKE.md`
- Specs: `Project_README.md`, `README.md`
- Product / UX docs: `Flavor.md`, `docs/NOW.md`

---

## 6. Change Log (High-Level Decisions)

Use this section for **big decisions** only:

- `YYYY-MM-DD` – Decided on X instead of Y.
- `YYYY-MM-DD` – Switched primary deployment target to Z.
