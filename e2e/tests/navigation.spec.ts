import { test, expect } from '@playwright/test';

test('bookshelf lists books and opens one', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await page.getByRole('link', { name: /The Smart Ebook Guide/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Getting started with smart ebooks' }),
  ).toBeVisible();
});

test('sidebar navigates between chapters', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(
    page.getByRole('heading', { name: 'Getting started with smart ebooks' }),
  ).toBeVisible();

  const sidebar = page.locator('.sidebar');
  await sidebar.getByRole('link', { name: 'The interactivity toolkit' }).click();
  await expect(page.getByRole('heading', { name: 'The interactivity toolkit' })).toBeVisible();
});

test('a book with parts groups its chapters, and one without does not', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');

  const sidebar = page.locator('.sidebar');
  await expect(sidebar.getByRole('heading', { name: 'Part I — Reading a game' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Part II — Writing one' })).toBeVisible();

  // A nested list, not headings scattered through a flat one: a screen reader
  // should be able to announce the part and skip its chapters as a group.
  // Matched on the full title: "Part I" is a substring of "Part II", so the
  // short form silently selects both groups.
  const partOne = sidebar.locator('.sidebar__part', { hasText: 'Part I — Reading a game' });
  await expect(partOne.getByRole('link')).toHaveCount(2);
  await expect(partOne.getByRole('link', { name: /A chess game, move by move/ })).toBeVisible();

  // Grouping is presentation only — the chapters are still one flat sequence,
  // so navigation across a part boundary is an ordinary next step.
  await sidebar.getByRole('link', { name: /A game from a file/ }).click();
  await expect(page).toHaveURL(/03-a-game-from-a-file/);

  // The guide declares no parts and must render exactly as it always did.
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('.sidebar .sidebar__part')).toHaveCount(0);
  await expect(page.locator('.sidebar__list > li')).toHaveCount(3);
});

test('search finds content and links to a chapter', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await page.getByPlaceholder('Search…').fill('matching');
  await page.getByPlaceholder('Search…').press('Enter');

  await expect(page.getByRole('heading', { name: /Search/ })).toBeVisible();
  const firstResult = page.locator('.search-view__list a').first();
  await expect(firstResult).toBeVisible();
  await firstResult.click();
  await expect(page.locator('article.prose')).toBeVisible();
});

test('theme toggle persists across reload', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: /Theme:/ });

  // Cycle to an explicit theme and confirm the attribute is set.
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', /light|dark/);
  const chosen = await html.getAttribute('data-theme');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', chosen ?? '');
});
