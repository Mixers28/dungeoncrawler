import { test, expect, type Page } from '@playwright/test';

// Visual Phase 0 smoke test: signup → Wizard character (to exercise real spells) →
// toggle to visual mode → drive movement/action/inventory/spellbook controls entirely
// by button, with zero free-text input. Companion to e2e/smoke.spec.ts, which covers
// the text-mode path.
//
// Requires local Postgres (docker-compose) and .env.local with DATABASE_URL.

const PASSWORD = 'smoke-test-pass-1';

function uniqueEmail() {
  return `visual-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

async function reachVisualGameplay(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  await page.locator('input[type="email"]').fill(uniqueEmail());
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page.getByRole('heading', { name: 'Choose Your Path' })).toBeVisible();
  // Wizard has real prepared spells, so the spellbook drawer has content to click.
  await page.getByRole('button', { name: /Wizard/i }).click();
  await page.getByRole('button', { name: 'Enter the Realm' }).click();

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

  // Gameplay starts in text mode; switch to the visual shell.
  await page.getByTestId('toggle-view-mode').click();
  await expect(page.getByTestId('dungeon-viewport')).toBeVisible();
}

test('visual mode: shell landmarks render with no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));

  await reachVisualGameplay(page);

  await expect(page.getByTestId('party-rail')).toBeVisible();
  await expect(page.getByTestId('dungeon-viewport')).toBeVisible();
  await expect(page.getByTestId('action-tray')).toBeVisible();
  await expect(page.getByText('YOU', { exact: true })).toBeVisible();

  // The narration log lives in a drawer in visual mode.
  await page.getByTestId('open-log-drawer').click();
  await expect(page.getByTestId('log-strip')).toBeVisible();
  await page.getByLabel('Close Adventure Log').click();
  await expect(page.getByTestId('log-strip')).toHaveCount(0);

  await page.getByRole('button', { name: 'Create Party' }).click();
  await expect(page.getByText(/Party [A-Z2-9]{6}/)).toBeVisible();
  await expect(page.getByTestId('party-rail')).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('visual mode: movement action dispatches a command and updates the log', async ({ page }) => {
  await reachVisualGameplay(page);

  const moveButtons = page.getByTestId('movement-action');

  // The gate scene always has at least one mapped exit in Act 1.
  await expect(moveButtons.first()).toBeVisible();
  await moveButtons.first().click();

  // Log entries are shown inside the Adventure Log drawer in visual mode.
  await page.getByTestId('open-log-drawer').click();
  const logStrip = page.getByTestId('log-strip');
  await expect(logStrip).toBeVisible();
  await expect(logStrip.getByText('No messages yet')).toHaveCount(0);
  await expect(page.getByText('Failed to process turn')).toHaveCount(0);
});

test('visual mode: inventory drawer opens, quick-uses an item, and auto-closes', async ({ page }) => {
  await reachVisualGameplay(page);

  await page.getByTestId('open-inventory-drawer').click();
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Manage Full Inventory/i })).toBeVisible();

  const quickUseButtons = page.getByTestId('quick-use-actions').getByRole('button');
  const quickUseCount = await quickUseButtons.count();

  if (quickUseCount > 0) {
    await quickUseButtons.first().click();
    // Drawer auto-closes after dispatching a command from inside it.
    await expect(page.getByRole('heading', { name: 'Inventory' })).toHaveCount(0);
    await expect(page.getByText('Failed to process turn')).toHaveCount(0);
  } else {
    await page.getByLabel('Close Inventory').click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toHaveCount(0);
  }
});

test('visual mode: spellbook drawer opens, casts a spell, and auto-closes', async ({ page }) => {
  await reachVisualGameplay(page);

  await page.getByTestId('open-spellbook-drawer').click();
  await expect(page.getByRole('heading', { name: 'Spellbook' })).toBeVisible();

  const spellButtons = page.getByTestId('spell-actions').getByRole('button');
  const spellCount = await spellButtons.count();
  expect(spellCount).toBe(10); // Wizard shows all assigned known spells: 4 cantrips + 6 spellbook entries.
  await expect(page.getByRole('button', { name: /Fire Bolt Cantrip/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Mage Armor Prepared/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Detect Magic Known/i })).toBeDisabled();

  await spellButtons.first().click();
  await expect(page.getByRole('heading', { name: 'Spellbook' })).toHaveCount(0);
  await expect(page.getByText('Failed to process turn')).toHaveCount(0);
});
