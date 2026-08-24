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
