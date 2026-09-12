import { test, expect } from '@playwright/test';

/**
 * SPEC011 — a gamebook, read the way one is meant to be read.
 *
 * Everything below this had been unit-tested and never *read*: per-unit
 * delivery (SPEC005 M2), the shell's gate (SPEC002 R1.1a), the unit an island
 * knows it is in (SPEC001 P2.7) and the journey (K2.5). §8.5 says the demo is
 * the only way to find out whether the guided model is any good, which no
 * amount of specification settles — so these assertions are about the *rules of
 * play*, not appearance.
 */
const BOOK = '/#/gamebook/01-the-cellar-door';

test('the reader is given one section, and cannot reach the ending', async ({ page }) => {
  await page.goto(BOOK);

  const prose = page.locator('article.prose');
  await expect(prose).toContainText('The cellar door stands open');

  // The whole point of delivering one unit: section 20 is not merely hidden,
  // it is absent, so neither scrolling nor Ctrl+F can reach it (B2).
  await expect(prose).not.toContainText('You walk until the houses stop');
  await expect(prose).not.toContainText('The steps are wet');
});

test('the contents list is earned rather than given', async ({ page }) => {
  await page.goto(BOOK);

  /*
   * §4.1 says the list "starts one entry long". It does not, and the rail is
   * right: it renders nothing below two entries, because one entry is a
   * restatement of the title rather than a contents list (SPEC002 N6). The
   * property that actually matters survives — the list is the reader's own
   * history and it grows by reading — so it is asserted here and §4.1 is
   * corrected rather than the rail.
   */
  const entries = page.locator('.toc a');
  await expect(entries).toHaveCount(0);

  await page.getByRole('link', { name: 'turn to 2' }).click();
  await expect(page.locator('article.prose')).toContainText('The steps are wet');

  // Two sections reached, of twenty that exist.
  await expect(entries).toHaveCount(2);
});

test('a section refused is not reachable by typing its address', async ({ page }) => {
  await page.goto(`${BOOK}?s=20`);

  // §4.2e: the refusal is silent. "Section 20 exists but is locked" would
  // itself be the spoiler, so the reader simply gets where they are.
  const prose = page.locator('article.prose');
  await expect(prose).toContainText('The cellar door stands open');
  await expect(prose).not.toContainText('You walk until the houses stop');
});

test('a road already walked is inert, and says which way you went', async ({ page }) => {
  await page.goto(BOOK);

  await page.getByRole('link', { name: 'turn to 2' }).click();
  await expect(page.locator('article.prose')).toContainText('The steps are wet');

  // Back to a section already left, through the contents list.
  await page.locator('.toc a').first().click();
  await expect(page.locator('article.prose')).toContainText('The cellar door stands open');

  // §4.2b and QG12: the road taken and the road refused, both in the prose,
  // and neither of them a control any more.
  await expect(page.locator('.gamebook-choice--taken')).toContainText('you went this way');
  await expect(page.locator('.gamebook-choice--refused')).toContainText('not taken');
  await expect(page.getByRole('link', { name: 'turn to 3' })).toHaveCount(0);
});

test('the journey survives a reload', async ({ page }) => {
  await page.goto(BOOK);
  await page.getByRole('link', { name: 'turn to 2' }).click();
  await expect(page.locator('article.prose')).toContainText('The steps are wet');

  await page.reload();

  // K2.1: one record per playthrough, written before the route changed.
  await expect(page.locator('.toc a')).toHaveCount(2);
});
