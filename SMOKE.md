# Smoke Test Runbook

Use this to sanity-check setup, deterministic game resolution, persistence, and the browser flow.

## Prereqs

```bash
npm install
docker compose up -d
cp .env.local.example .env.local
npm run db:migrate
```

Required `.env.local` values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dungeoncrawler
AUTH_SECRET=<generate with: openssl rand -base64 32>
```

## Fast Local Checks

```bash
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
```

`npm run build` writes `lib/build-info.ts`; avoid committing timestamp-only changes unless intentionally updating build metadata.

## Manual Browser Flow

Start the app:

```bash
npm run dev
```

Then visit http://localhost:3000.

1. Logged-out `/` redirects to `/login`.
2. Sign up with a fresh email.
3. Choose a class and start a run.
4. Click through the prologue until the command input appears.
5. Run factual commands:
   - `check skills` shows skills, equipped weapon, armor, proficiencies, spells, and slots.
   - `look around` reports the current location, threats, exits, and trader if present.
   - `attack` uses the equipped weapon.
   - `attack skeleton` targets the named enemy when present.
   - `attack with greatsword` rejects the command if the weapon is not in inventory.
   - `equip handaxe` changes the equipped weapon.
   - `drop healing potion` removes or decrements the item.
   - `drop iron key` refuses to discard a key item.
   - `cast <starter spell>` resolves modeled spell mechanics or rejects unknown/unprepared spells.
6. Reload mid-run and confirm HP, inventory, log, and location restore from the database save.
7. Use "New Run" and confirm a fresh save replaces the previous run.

## Automated Browser Smoke

```bash
npm run test:e2e
```

Notes:

- Playwright auto-starts `next dev`.
- Local Postgres and `.env.local` are required.
- The smoke spec signs up a fresh throwaway user each run.
