import { test, expect } from '@playwright/test';

/**
 * SPEC017. The engraver is a lazy dependency and draws asynchronously, so these
 * wait for the notes rather than for the element that will hold them.
 */
test('a figure is engraved from its abc source', async ({ page }) => {
  await page.goto('/#/music/01-the-stave');

  const figure = page.locator('.island--music').first();
  await expect(figure).toBeVisible();

  // Real engraving, not the source fallback: abcjs draws note heads as paths.
  await expect(figure.locator('svg')).toBeVisible({ timeout: 30_000 });
  await expect(figure.locator('svg path').first()).toBeVisible();

  // The ABC is the *static* form (§4.4). With the island alive the reader gets
  // notes instead, and seeing both would mean the fallback leaked onto the page.
  await expect(figure.locator('pre')).toHaveCount(0);
  await expect(page.getByText('CDEF|GABc|')).toHaveCount(0);
});

test('every figure in the chapter draws, and each says what it is', async ({ page }) => {
  await page.goto('/#/music/01-the-stave');

  const figures = page.locator('.island--music');
  await expect(figures).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    await expect(figures.nth(i).locator('svg')).toBeVisible({ timeout: 30_000 });
    // The caption is the accessible name: the engraving itself is hidden from
    // a screen reader, so a figure with nothing to say would be a blank.
    await expect(figures.nth(i).locator('figcaption')).not.toBeEmpty();
  }
});
