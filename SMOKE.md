# Smoke Test Runbook (manual)

Use this to sanity‑check the hybrid facts+flavor flow without extra tooling.

## Prereqs
- `npm install` (once)
- `.env.local` with Supabase keys for auth; start a local or connected Supabase instance.
- Terminal 1: `npm run dev`

## Flow
1) Open http://localhost:3000, start a new game (ensures skills/log backfill).
2) Enter commands and expect factual fact blocks:
   - `check skills` → shows “Skills: … Equipped weapon: … Armor: …”
   - `attack the rat with longsword` → uses longsword dice from 5e, names the weapon in facts.
   - `cast fireball on rat` → deterministic rejection line (“no learned abilities…” for now).
   - `look around` → factual event + optional 1-line flavor (no numbers/items/skills listed).
3) Reload an old save if you have one → log should populate even if only `narrativeHistory` existed; skills should be present.

## Optional automation
If you want browser automation, add Playwright:
```
npm i -D @playwright/test
npx playwright install --with-deps
```
Create `tests/smoke.spec.ts` that:
```
import { test, expect } from '@playwright/test';
test('facts + flavor', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // perform login/start game as your app requires, then:
  await page.fill('input[placeholder="What do you do?"]', 'check skills');
  await page.click('text=ACT');
  await expect(page.getByText('Skills:')).toBeVisible();
});
```
Run with `npx playwright test` while `npm run dev` is active.
