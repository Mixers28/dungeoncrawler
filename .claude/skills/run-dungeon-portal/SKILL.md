---
name: run-dungeon-portal
description: Use this skill to launch and drive the Dungeon Portal Next.js app for manual verification — starting the dev server, getting a fresh logged-in session past character select and the prologue, and reaching either text-mode or visual-mode gameplay. Use whenever a change to app/page.tsx, components/**, lib/game/**, or the visual shell needs to be exercised in a real browser rather than just typechecked or unit tested.
---

# Run Dungeon Portal

This is the project-specific recipe for the generic `run` skill's "browser-driven web
app" pattern. It exists because this app requires Postgres plus a full
signup → character-select → prologue flow before any gameplay screen is reachable,
and there is no `chromium-cli` binary in this environment — drive it with the
project's own `playwright` dependency instead.

## 1. Prerequisites

- Local Postgres must be running: `docker compose ps` should show
  `dungeoncrawler-postgres-1` as `Up`. If not: `docker compose up -d`.
- `.env.local` must exist with `DATABASE_URL` and `AUTH_SECRET` (see
  `docs/PROJECT_CONTEXT.md`).
- Migrations applied at least once: `npm run db:migrate`.

## 2. Start the dev server

```bash
pkill -f "next dev" 2>/dev/null   # avoid EADDRINUSE from a stale run
npm run dev > /tmp/dc-dev-server.log 2>&1 &
disown
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|307\|302" && break
  sleep 1
done
```

Stop it later with `pkill -f "next dev"`.

## 3. Drive it with Playwright (no chromium-cli here)

`chromium-cli` is not installed in this environment. The repo already has
`playwright` and `@playwright/test` as dependencies (used by `e2e/smoke.spec.ts`),
so write throwaway driver scripts into the project directory itself — a script
placed outside the repo (e.g. in the scratchpad) will fail with
`Cannot find module 'playwright'` because Node resolves `node_modules` from the
script's own path, not the cwd. Name it `*.tmp.js` and delete it when done; it
must not be committed (see `docs/agent-crossover-contract.md` — this is a
Claude Code frontend verification concern, not a tracked test).

Minimal skeleton — full flow through gameplay:

```js
const { chromium } = require('playwright');

function uniqueEmail() {
  return `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto('http://localhost:3000');
  await page.waitForURL(/\/login/, { timeout: 15000 });

  // Sign up a fresh throwaway user — a fresh save has no prior state to conflict with.
  await page.locator('input[type="email"]').fill(uniqueEmail());
  await page.locator('input[type="password"]').fill('smoke-test-pass-1');
  await page.getByRole('button', { name: 'Sign Up' }).click();

  // Character select — Fighter is preselected.
  await page.getByRole('heading', { name: 'Choose Your Path' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Enter the Realm' }).click();

  // Three-part prologue overlay. Clicks can be swallowed mid-animation — retry.
  await page.getByRole('heading', { name: 'Part 1' }).waitFor({ timeout: 15000 });
  for (const nextPart of ['Part 2', 'Part 3']) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('heading', { name: nextPart }).waitFor({ timeout: 2000 });
        break;
      } catch (e) { if (attempt === 4) throw e; }
    }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.getByRole('button', { name: 'Begin Adventure' }).click();
      await page.getByPlaceholder('What do you do?').waitFor({ timeout: 2000 });
      break;
    } catch (e) { if (attempt === 4) throw e; }
  }

  // Now in gameplay, text mode by default. Toggle to visual mode:
  // await page.locator('button[title*="Switch to visual mode"]').click();

  await page.screenshot({ path: '/tmp/dc-gameplay.png' });
  console.log('Console errors:', consoleErrors.length ? consoleErrors : 'none');
  await browser.close();
})();
```

Run it from inside the repo root so `require('playwright')` resolves:

```bash
node /path/to/verify.tmp.js
```

## 4. What to check

- `console --errors`-equivalent: the `consoleErrors` array above must be empty.
- Screenshot and actually look at it — a blank or half-rendered frame is a failure,
  not a pass.
- For visual-mode changes specifically: toggle via
  `button[title*="Switch to visual mode"]`, then check for the shell landmarks —
  party rail (`text=YOU`), viewport (scene image + location label), movement
  buttons (labels come from real story exit data via
  `buildVisualGameViewModel`, not fixed strings — don't hardcode "Forward"/"Back"
  in assertions), action tray, and the compact log strip.

## 5. Known gotchas

- `tailwind.config.ts`'s `content` globs must include `./components/**/*` —
  historically they only listed `./app/**/*` and `./src/**/*`, which silently
  purges any Tailwind utility class that's unique to a component file (never
  duplicated in `app/page.tsx`). This breaks `md:`-prefixed responsive classes
  in particular — a component can look fine in isolation but collapse to its
  mobile layout at any viewport width. If a new component's desktop layout
  looks wrong in a screenshot, check this first before assuming a logic bug.
- Playwright's `getByRole('button', { name: 'ACT' })` can strict-mode-fail if
  another button's accessible name contains "ACT" as a substring (e.g.
  "Interact") — use `{ name: 'ACT', exact: true }`.
- The signup form always creates a brand-new save; there is no need to clean up
  test users afterward for local verification (this mirrors `e2e/smoke.spec.ts`).
