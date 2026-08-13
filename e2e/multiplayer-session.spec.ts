import { test, expect, type Browser, type Page } from '@playwright/test';

const PASSWORD = 'smoke-test-pass-1';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

async function signUpAndReachGameplay(page: Page, emailPrefix: string) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  await page.locator('input[type="email"]').fill(uniqueEmail(emailPrefix));
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page.getByRole('heading', { name: 'Choose Your Path' })).toBeVisible();
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
}

async function switchToVisual(page: Page) {
  // Decide from the text-mode input, not from the absence of the viewport:
  // the visual shell renders a "Loading visual view…" placeholder (with no
  // viewport testid) until its view model resolves, and toggling during that
  // window used to flip an already-visual page back into text mode.
  const textModeInput = page.getByPlaceholder('What do you do?');
  if (await textModeInput.isVisible().catch(() => false)) {
    await page.getByTestId('toggle-view-mode').click();
  }
  await expect(page.getByTestId('dungeon-viewport')).toBeVisible({ timeout: 20_000 });
}

async function createParty(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Create Party' }).click();
  const partyBanner = page.getByText(/Party [A-Z2-9]{6}/);
  await expect(partyBanner).toBeVisible();
  const text = await partyBanner.innerText();
  const code = text.match(/Party ([A-Z2-9]{6})/)?.[1];
  expect(code).toBeTruthy();
  return code!;
}

async function joinParty(page: Page, code: string) {
  await page.getByPlaceholder('CODE').first().fill(code);
  await page.getByRole('button', { name: 'Join' }).first().click();
  await expect(page.getByText(`Party ${code}`)).toBeVisible();
}

test('multiplayer: create party, join by code, poll shared movement', async ({ browser }: { browser: Browser }) => {
  const ownerContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const joiner = await joinerContext.newPage();

  try {
    await signUpAndReachGameplay(owner, 'mp-owner');
    await switchToVisual(owner);
    const code = await createParty(owner);
    // Assert the solo-party state before the joiner exists: once they join, the
    // owner's poll replaces this with "2 players", so asserting it later was a
    // race against the polling interval.
    await expect(owner.getByText('1 player')).toBeVisible();

    await signUpAndReachGameplay(joiner, 'mp-joiner');
    await joinParty(joiner, code);
    await switchToVisual(joiner);

    await expect(joiner.getByText('2 players')).toBeVisible();
    await expect(owner.getByText('2 players')).toBeVisible({ timeout: 6_000 });

    await owner.getByTestId('movement-action').first().click();

    // The narration log lives in the Adventure Log drawer in visual mode.
    await owner.getByTestId('open-log-drawer').click();
    await expect(owner.getByTestId('log-strip').getByText(/Iron Gate|Gatehouse|Courtyard|move|open/i).first()).toBeVisible();
    await joiner.getByTestId('open-log-drawer').click();
    await expect(joiner.getByTestId('log-strip').getByText(/Iron Gate|Gatehouse|Courtyard|move|open/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(joiner.getByText('2 players')).toBeVisible();
  } finally {
    await ownerContext.close();
    await joinerContext.close();
  }
});
