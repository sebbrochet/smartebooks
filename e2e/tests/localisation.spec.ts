import { test, expect } from '@playwright/test';

/**
 * SPEC015: the shell follows the *reader*, the book follows the *book*.
 *
 * A unit test can prove the French catalogue is complete and still tell you
 * nothing about whether a French browser ever reaches it — the resolution runs
 * against `navigator.languages`, which only a real browser has. This is the
 * only place that claim can be made.
 */
test.describe('a reader whose browser asks for French', () => {
  test.use({ locale: 'fr-FR' });

  test('gets French chrome around a book that stays in its own language', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    await expect(page.getByRole('button', { name: 'Sommaire' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rechercher', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contents' })).toHaveCount(0);

    // The document is the shell's; the article is the book's, and the book did
    // not change language because the reader did.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('article.prose')).not.toHaveAttribute('lang', 'fr');
  });
});

test.describe('a reader whose browser asks for something we do not speak', () => {
  test.use({ locale: 'de-DE' });

  test('is given English rather than nothing', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
