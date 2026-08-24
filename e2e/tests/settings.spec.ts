import { test, expect } from '@playwright/test';

test('the pre-1.0 theme key migrates to the namespaced one', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smart-ebook-theme', 'dark'));
  await page.goto('/');

  // The no-FOUC script still honours the old key, so there is no theme flash.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // …and the value moves to the namespaced key, with the old one removed.
  const [migrated, legacy] = await page.evaluate(() => [
    localStorage.getItem('smart-ebooks:theme'),
    localStorage.getItem('smart-ebook-theme'),
  ]);
  expect(migrated).toBe('dark');
  expect(legacy).toBeNull();
});

test('a bundled book renders its packaged cover, and others fall back', async ({ page }) => {
  await page.goto('/');

  // The guide packages assets/cover.svg, so it resolves to a Blob URL…
  const guide = page.getByRole('link', { name: /The Smart Ebook Guide/ });
  await expect(guide.locator('img.bookcover')).toHaveAttribute('src', /^blob:/);

  // …while a book without artwork gets a generated title card instead.
  const chess = page.getByRole('link', { name: /Chess/ });
  await expect(chess.locator('.bookcover--generated')).toBeVisible();
});
