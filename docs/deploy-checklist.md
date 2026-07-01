---
name: deploy-checklist
description: Release validation checklist — build, login flow, combat/dice, story navigation
---

# Deploy Checklist

Follow top to bottom for every production deploy (Railway). Check items off as you go.

## 1. Pre-deploy (local)

- [ ] `main` is up to date and the working tree is clean (`git status`).
- [ ] `npm run lint` passes (no new errors beyond known baseline).
- [ ] `npm run build` succeeds locally.
- [ ] `npm run test:e2e` passes (requires local Postgres: `docker compose up -d`).

## 2. Environment (Railway)

- [ ] `DATABASE_URL` points at the production Postgres.
- [ ] `AUTH_SECRET` is set (generate with `openssl rand -base64 32`; never reuse the dev value).
- [ ] Build/runtime logs show no missing-env warnings on boot.
- [ ] Build info resolves: deployed footer/build SHA matches the pushed commit
      (`scripts/write-build-info.js` picks up `RAILWAY_GIT_COMMIT_SHA` automatically).

## 3. Database

- [ ] Drizzle migrations applied against production (`npm run db:migrate` with prod `DATABASE_URL`).
- [ ] Save audit is clean: `npm run db:migrate-saves` (dry run) reports **0 incompatible** saves.
      Investigate any ✗ rows before deploying; backfill with `-- --apply` if appropriate.

## 4. Post-deploy validation — login flow

- [ ] Visiting `/` while logged out redirects to `/login`.
- [ ] Wrong password shows "Invalid email or password." (no crash, no redirect loop).
- [ ] Sign-up with a fresh email works and lands on character selection.
- [ ] Log in with an existing account works; no redirect loop between `/` and `/login`.

## 5. Post-deploy validation — game start + combat/dice

- [ ] Pick a class → "Enter the Realm" → prologue plays → game input appears.
- [ ] `check skills` returns factual sheet output (skills, equipped weapon, armor, slots).
- [ ] `attack` resolves and the Dice Tray shows the attack/damage rolls.
- [ ] Cast a starter spell: slots decrement and the roll (attack or save vs DC) appears.
- [ ] Use a consumable from the sidebar: inventory count drops and the effect applies.

## 6. Post-deploy validation — story navigation

- [ ] `look around` reports the current location and threats.
- [ ] Moving through an exit transitions scenes and logs the transition.
- [ ] A gated exit without the required item shows an explicit locked reason.
- [ ] Quest sidebar shows active objectives and updates on progress.

## 7. Persistence + wrap-up

- [ ] Reload the page mid-run: the save restores (log, HP, inventory intact).
- [ ] "New Run" resets to a fresh game without errors.
- [ ] Skim Railway runtime logs for errors/warnings during the validation session.
- [ ] If anything above fails: roll back by redeploying the previous commit on Railway,
      then file the failure in `docs/NOW.md`.
