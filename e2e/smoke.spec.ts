import { test, expect, type Page } from '@playwright/test';

// Sprint 3.1 smoke test: login/signup → start game → check skills → attack → loot.
// Requires local Postgres (docker-compose) and .env.local with DATABASE_URL.

const PASSWORD = 'smoke-test-pass-1';

function uniqueEmail() {
  return `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

async function sendCommand(page: Page, command: string): Promise<string> {
  const input = page.getByPlaceholder('What do you do?');
  const responses = page.locator('div.rounded-tl-none');
  const before = await responses.count();

  await input.fill(command);
  await page.getByRole('button', { name: 'ACT' }).click();

  await expect(responses.nth(before)).toBeVisible();
  await expect(page.getByText('Failed to process turn')).toHaveCount(0);
  return (await responses.nth(before).innerText()).trim();
}

test('smoke: signup, start game, check skills, attack, loot', async ({ page }) => {
  // 1. LOGIN — unauthenticated visitors are redirected to /login.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Dungeon Portal' })).toBeVisible();

  // Sign up a fresh user so the run starts without a prior save.
  await page.locator('input[type="email"]').fill(uniqueEmail());
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  // 2. START — character select, fighter preselected.
  await expect(page.getByRole('heading', { name: 'Choose Your Path' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the Realm' }).click();

  // Fresh save shows the three-part prologue. Clicks can be swallowed while
  // the overlay is still hydrating/animating, so click-and-verify with retry.
  await expect(page.getByRole('heading', { name: 'Part 1' })).toBeVisible();
  for (const nextPart of ['Part 2', 'Part 3']) {
    await expect(async () => {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: nextPart })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }
  await expect(async () => {
    await page.getByRole('button', { name: 'Begin Adventure' }).click();
    await expect(page.getByPlaceholder('What do you do?')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  // 3. CHECK SKILLS — factual sheet output from the 5e reference layer.
  const skills = await sendCommand(page, 'check skills');
  expect(skills).toMatch(/Skills:/);
  expect(skills).toMatch(/Equipped weapon:/);

  // 4. ATTACK — engine resolves the command and reports an outcome.
  const attack = await sendCommand(page, 'attack');
  expect(attack.length).toBeGreaterThan(0);

  // 5. LOOT — resolves whether or not a corpse is available.
  const loot = await sendCommand(page, 'loot');
  expect(loot.length).toBeGreaterThan(0);
});
