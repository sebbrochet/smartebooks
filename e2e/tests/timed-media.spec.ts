import { test, expect } from '@playwright/test';

/**
 * SPEC012 V1.1 — a recording the prose can drive.
 *
 * This island exists to answer a question rather than to ship a feature: the
 * engine's sequence primitive was written for chess and justified in its own
 * comment as covering "music timestamps" too, with no second consumer to say
 * whether that was true. These are the assertions that settle it, so they are
 * deliberately about the *two directions* rather than about appearance.
 *
 * The bundled sample is about three seconds long, so the marks sit close
 * together. That makes the demo thin and the test no weaker: nothing here
 * depends on the gap between marks.
 */
const CHAPTER = '/#/guide/01-getting-started';

test('a moment named in a sentence seeks the recording', async ({ page }) => {
  await page.goto(CHAPTER);

  const player = page.getByTestId('media-lesson-player');
  await expect(player).toBeVisible({ timeout: 20_000 });

  // The prose drives the clock: this is `:move[2. Bc4]` for a recording.
  await page.getByRole('button', { name: /^0:01/ }).first().click();
  await expect
    .poll(() => player.evaluate((el: HTMLMediaElement) => Math.round(el.currentTime)))
    .toBe(1);

  const index = page.locator('.media-marks');
  await expect(index.locator('[aria-current="true"]')).toContainText('Where it turns');
});

test('the clock drives the prose, which is the direction chess never had', async ({ page }) => {
  await page.goto(CHAPTER);

  const player = page.getByTestId('media-lesson-player');
  await expect(player).toBeVisible({ timeout: 20_000 });
  await player.evaluate((el: HTMLMediaElement) => el.load());

  /*
   * Scrubbing is the reader moving the clock without touching the prose, which
   * is the case chess has no analogue for: there, a position only ever changes
   * because somebody asked for it. Here the source of truth lives outside React
   * and moves on its own.
   */
  await player.evaluate((el: HTMLMediaElement) => {
    el.currentTime = 2;
  });

  const index = page.locator('.media-marks');
  await expect(index.locator('[aria-current="true"]')).toContainText('The last word', {
    timeout: 10_000,
  });
});

test('a moment the author never marked stays the words they wrote', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.getByTestId('media-lesson-player')).toBeVisible({ timeout: 20_000 });

  const prose = page.getByTestId('media-lesson-prose');
  await expect(prose).toContainText('9:59');
  // The forgiving runtime (SPEC001 P1.2): an unresolvable mark is not an error
  // on the page, it is the plain text the author typed.
  await expect(prose.getByRole('button', { name: /9:59/ })).toHaveCount(0);
});

test('the player holds still while the prose scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(CHAPTER);

  const player = page.getByTestId('media-lesson-player');
  await expect(player).toBeVisible({ timeout: 20_000 });
  const before = await player.boundingBox();

  const prose = page.getByTestId('media-lesson-prose');
  await prose.evaluate((el) => el.scrollBy(0, 400));
  await expect.poll(() => prose.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  // SPEC008 §4.13 reached this by three failed attempts at a board in the flow.
  // The conclusion transfers; this asserts it rather than assuming it.
  const after = await player.boundingBox();
  expect(Math.round(after!.y)).toBe(Math.round(before!.y));
});

test('the index is a timecoded list, and every board-shaped rule still holds', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.getByTestId('media-lesson-player')).toBeVisible({ timeout: 20_000 });

  const marks = page.locator('.media-marks__item');
  await expect(marks).toHaveCount(3);
  await expect(marks.first()).toContainText('0:00');
  await expect(marks.first()).toContainText('The opening tone');
});
