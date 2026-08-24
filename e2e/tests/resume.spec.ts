import { test, expect } from '@playwright/test';

const CHAPTER = '/#/guide/02-interactivity-toolkit';

test('returning to the site resumes the last book and chapter', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.getByRole('heading', { name: /interactivity/i }).first()).toBeVisible();

  // Come back to the bare entry URL, as a returning reader would.
  await page.goto('/');
  await expect(page).toHaveURL(/02-interactivity-toolkit/);
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
