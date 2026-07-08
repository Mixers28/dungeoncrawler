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
  if (await page.getByTestId('dungeon-viewport').count() === 0) {
    await page.getByTestId('toggle-view-mode').click();
  }
  await expect(page.getByTestId('dungeon-viewport')).toBeVisible();
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

    await signUpAndReachGameplay(joiner, 'mp-joiner');
    await joinParty(joiner, code);
    await switchToVisual(joiner);

    await expect(owner.getByText('1 player')).toBeVisible();
    await expect(joiner.getByText('2 players')).toBeVisible();
    await expect(owner.getByText('2 players')).toBeVisible({ timeout: 6_000 });

    await owner.getByTestId('movement-action').first().click();

    await expect(owner.getByTestId('log-strip').getByText(/Iron Gate|Gatehouse|Courtyard|move|open/i)).toBeVisible();
    await expect(joiner.getByTestId('log-strip').getByText(/Iron Gate|Gatehouse|Courtyard|move|open/i)).toBeVisible({ timeout: 8_000 });
    await expect(joiner.getByText('2 players')).toBeVisible();
  } finally {
    await ownerContext.close();
    await joinerContext.close();
  }
});
