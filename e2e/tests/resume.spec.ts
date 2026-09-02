import { test, expect } from '@playwright/test';

const CHAPTER = '/#/guide/02-interactivity-toolkit';

test('returning to the site resumes the last book and chapter', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.getByRole('heading', { name: /interactivity/i }).first()).toBeVisible();

  // Come back to the bare entry URL, as a returning reader would.
  await page.goto('/');
  await expect(page).toHaveURL(/02-interactivity-toolkit/);
});

test('resume returns to the place, not just to the chapter', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();

  // Read down to a section, and pause long enough for the position to be
  // written — it is deliberately not saved on every scroll frame.
  await page.evaluate(() => {
    const heading = document.getElementById('play-a-matching-game');
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY + 40);
  });
  const left = await page.evaluate(() => window.scrollY);
  expect(left).toBeGreaterThan(0);
  await page.waitForTimeout(1200);

  // Come back the way a returning reader does. Note *not* via `#/`: asking
  // for the library is a choice the app deliberately remembers, and it
  // suppresses resume.
  await page.goto('/');
  await expect(page).toHaveURL(/01-getting-started/);

  // Within a line or two of where they stopped. Returning to the chapter but
  // not the place is most of the way to not resuming at all.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(left - 60);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(left + 60);
});

test('a deep link wins over a remembered place', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(1200);

  // Asking for a section must not be overruled by where this reader happened
  // to stop last time.
  await page.goto('/#/guide/01-getting-started?s=test-yourself');
  await expect(page.locator('h2#test-yourself')).toBeInViewport();
});

test('a deep link is never hijacked by resume', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page).toHaveURL(/02-interactivity-toolkit/);

  // A different book, linked directly, must win over the resume pointer.
  await page.goto('/#/chess/01-chess-basics');
  await expect(page).toHaveURL(/chess/);
  await expect(page.getByRole('heading', { name: /A chess game, move by move/ })).toBeVisible();
});

test('choosing the library keeps you there, even after a refresh', async ({ page }) => {
  await page.goto(CHAPTER);
  await page.getByRole('link', { name: 'Smart Ebooks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});

test('the "always show my library" preference disables resume', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('resume-mode').selectOption('shelf');

  await page.goto(CHAPTER);
  await expect(page).toHaveURL(/02-interactivity-toolkit/);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});

test('cover mode shows a skippable splash before resuming', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('resume-mode').selectOption('cover');

  await page.goto(CHAPTER);
  await page.goto('/');

  const splash = page.getByTestId('cover-splash');
  await expect(splash).toBeVisible();

  // It continues on its own, but the reader can skip immediately.
  await page.getByRole('button', { name: 'Continue now' }).click();
  await expect(page).toHaveURL(/02-interactivity-toolkit/);
});
