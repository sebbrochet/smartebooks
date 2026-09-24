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

/**
 * SPEC017 QN1. A note named in a sentence drives the score above it, through
 * the engine's shared sequence primitive and nothing else.
 */
test('a note named in the prose shows where it is on the score', async ({ page }) => {
  await page.goto('/#/music/02-following-a-tune');
  await expect(page.locator('.island--piece svg')).toBeVisible({ timeout: 30_000 });

  // Nothing is claimed before the reader asks: an unread piece should not be
  // pointing at a note they never chose.
  await expect(page.locator('.abcjs-note.is-current')).toHaveCount(0);

  await page.getByRole('button', { name: 'E', exact: true }).click();
  await expect(page.locator('.abcjs-note.is-current')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'E', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

/**
 * The mark says *which* note, not merely that there is one. `nth` is the only
 * way the prose can name the third D rather than the first, and a book saying
 * "the last D" while pointing at an earlier one is wrong in a way no count of
 * highlighted elements would catch — as the chapter was, before this test.
 */
test('nth picks the repeat the sentence means', async ({ page }) => {
  await page.goto('/#/music/02-following-a-tune');
  await expect(page.locator('.island--piece svg')).toBeVisible({ timeout: 30_000 });

  const notes = page.locator('.abcjs-note');
  const total = await notes.count();

  // "The last D" in a tune whose notes run E E F G G F E D C C D E E D.
  await page.getByRole('button', { name: 'D', exact: true }).nth(1).click();
  await expect(notes.nth(total - 1)).toHaveClass(/is-current/);
});

test('only one note is marked at a time', async ({ page }) => {
  await page.goto('/#/music/02-following-a-tune');
  await expect(page.locator('.island--piece svg')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'E', exact: true }).click();
  await page.getByRole('button', { name: 'G', exact: true }).click();

  await expect(page.locator('.abcjs-note.is-current')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'E', exact: true })).not.toHaveAttribute(
    'aria-current',
    'true',
  );
});
