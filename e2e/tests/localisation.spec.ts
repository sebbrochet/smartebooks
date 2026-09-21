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

  /*
   * The risk translation actually carries is length. French runs longer than
   * English, "Avec empattements" is three times the width of "Serif", and a
   * panel sized around English is where that shows up first.
   */
  test('can read the reading settings without the panel bursting', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');
    await page.getByRole('button', { name: 'Réglages de lecture' }).click();

    const panel = page.locator('.reading-settings__panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Interligne')).toBeVisible();
    await expect(panel.getByRole('radio', { name: 'Avec empattements' })).toBeVisible();

    const overflowing = await panel.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflowing).toBe(false);
  });

  // The shelf is a different app from the reader, and its strings live in
  // apps/library rather than the engine — so it can drift independently.
  test('gets a French library too, not only a French reader', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Bibliothèque', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importer un livre' })).toBeVisible();
    await expect(page.getByText('À mon retour')).toBeVisible();
    await expect(page.getByText('Library', { exact: true })).toHaveCount(0);
  });

  /*
   * An island's own buttons are a third place the strings can drift: they are
   * neither the app nor the reader shell, and a reader meets them inside the
   * book's prose — where the surrounding words are the author's, not ours.
   */
  test('is offered a quiz in French, inside prose that stays the author’s', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    const quiz = page.locator('.island--quiz').first();
    await expect(quiz.getByRole('button', { name: 'Vérifier les réponses' })).toBeVisible();
    await expect(quiz.getByRole('button', { name: 'Check answers' })).toHaveCount(0);
  });
});

test.describe('a reader whose browser asks for something we do not speak', () => {
  test.use({ locale: 'de-DE' });

  test('is given English rather than nothing', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  /*
   * The whole reason the preference is stored as a *choice*: this reader's
   * device will never ask for French, so following it is not enough.
   *
   * And it has to take effect where they are standing. Until this shipped, the
   * resolved language was memoised per component on mount, so writing the
   * setting changed nothing until a reload — which is the sort of thing that
   * looks like the setting not working at all.
   */
  test('can ask for French anyway, and gets it without reloading', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');
    await page.getByRole('button', { name: 'Tools' }).click();
    await page.getByTestId('language-choice').selectOption('fr');

    await expect(page.getByRole('button', { name: 'Sommaire' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // The book is not the shell, and did not move.
    await expect(page.locator('article.prose')).not.toHaveAttribute('lang', 'fr');
  });

  test('keeps that choice on the next visit', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');
    await page.getByRole('button', { name: 'Tools' }).click();
    await page.getByTestId('language-choice').selectOption('fr');
    await expect(page.getByRole('button', { name: 'Sommaire' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: 'Sommaire' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});
