# Project Context – Long-Term Memory (LTM)

> High-level design, tech decisions, constraints for this project.  
> This is the **source of truth** for agents and humans.

<!-- SUMMARY_START -->
**Summary (auto-maintained by Agent):**
- Dungeon Portal is a Next.js dungeon crawler with Supabase auth/leaderboard (optional), localStorage saves, and canned narration.
- Story content lives in `story/*.json` and game state stays deterministic on the server.
- Deployment target is Railway, driven from a tracked git branch.
- Core game logic has been modularized under `lib/game/` with economy/progression and canned narration systems.
- A mechanics overlay for spells is sourced from SRD data and merged into the local 5e reference layer.
<!-- SUMMARY_END -->

---

## 1. Project Overview

- **Name:** Dungeon Portal
- **Owner:** TBD
- **Purpose:** Text-first dungeon crawler with deterministic mechanics, local saves, and optional Supabase auth/leaderboard.
- **Primary Stack:** Next.js (App Router), TypeScript, Supabase, Tailwind CSS.
- **Target Platforms:** Web (desktop/mobile), Railway deployment target.

---

## 2. Core Design Pillars

- Keep deterministic game state authoritative; narration decorates but does not mutate state.
- Keep story content in JSON so scenes/exits/rewards are data-driven.
- Keep auth/leaderboard in Supabase; saves live in localStorage with deterministic server actions.

---

## 3. Technical Decisions & Constraints

- Language(s): TypeScript/React for app; Markdown for docs.
- Framework(s): Next.js App Router; Tailwind CSS.
- Database / storage: Supabase for auth/leaderboard; localStorage for saves.
- Hosting / deployment: Railway, pulling from a git branch.
- Non-negotiable constraints:
  - Must remain backend-free and editor-native.
  - Documentation stays in plain Markdown for easy review.

---

## 4. Architecture Snapshot

- App lives in `app/` with server actions handling core game logic.
- Story scenes load from `story/*.json` with deterministic picks by seed.
- Supabase middleware handles sessions; saves live in localStorage; leaderboard writes to Supabase if configured.

---

## 5. Links & Related Docs

- Roadmap: `docs/phased-plan.md`
- Design docs: `PROJECT_STATUS.md`, `SMOKE.md`
- Specs: `Project_README.md`, `README.md`
- Product / UX docs: `docs/NOW.md`

---

## 6. Change Log (High-Level Decisions)

Use this section for **big decisions** only:

- `YYYY-MM-DD` – Decided on X instead of Y.
- `YYYY-MM-DD` – Switched primary deployment target to Z.
