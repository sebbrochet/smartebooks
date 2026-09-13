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

/**
 * Reported by the owner reading the book, 2026-09-13. Three findings, all of
 * which had shipped: search saw the whole file, the contents list collapsed a
 * route into a set, and a road already walked was inert text.
 */
/*
 * "creosote" appears exactly once in the book, in section 3, which section 1
 * offers but does not give you. The pair below is deliberately one word in two
 * states: the first draft of these tests searched for a word that was in the
 * *fixture* and not in the book, so it found nothing and passed against the
 * unfixed code. A spoiler test that cannot see the spoiler proves nothing.
 */
const ONLY_IN_SECTION_3 = 'creosote';

test('search cannot see a section the reader has not reached', async ({ page }) => {
  await page.goto(BOOK);

  await page.locator('.sidebar__search').click();
  await page.getByPlaceholder('Search this book…').fill(ONLY_IN_SECTION_3);

  // Section 3 is one choice away and must not be findable yet: a search that
  // answers with a section you have not reached is the spoiler the guided model
  // exists to prevent (QG7). It used to answer, and the link went nowhere — the
  // gate then refused the very unit the result named.
  await expect(page.locator('.search-overlay__list li')).toHaveCount(0);
});

test('search finds a section once it has been read', async ({ page }) => {
  await page.goto(BOOK);
  await page.getByRole('link', { name: 'turn to 3' }).click();
  await expect(page.locator('article.prose')).toContainText('The shed smells of creosote');

  await page.locator('.sidebar__search').click();
  await page.getByPlaceholder('Search this book…').fill(ONLY_IN_SECTION_3);

  // Searching what you have read is a memory aid rather than a spoiler.
  await expect(page.locator('.search-overlay__list li')).not.toHaveCount(0);
});

test('the contents list keeps the route, not the set of sections', async ({ page }) => {
  await page.goto(BOOK);

  // 1 → 2 → 1: a real gamebook loops, and the reader must be able to retrace
  // the order they actually went (§4.2a).
  await page.getByRole('link', { name: 'turn to 2' }).click();
  await expect(page.locator('article.prose')).toContainText('The steps are wet');
  await page.getByRole('link', { name: 'turn to 1' }).click();
  await expect(page.locator('article.prose')).toContainText('The cellar door stands open');

  await expect(page.locator('.toc a')).toHaveText(['1', '2', '1']);
});

test('a road already walked is a link back into your own history', async ({ page }) => {
  await page.goto(BOOK);

  await page.getByRole('link', { name: 'turn to 2' }).click();
  await page.locator('.toc a').first().click();
  await expect(page.locator('article.prose')).toContainText('The cellar door stands open');

  // Following your own route forward again is browsing, not replaying: it
  // navigates and records nothing (§4 rules 3 and 4).
  const taken = page.locator('a.gamebook-choice--taken');
  await expect(taken).toContainText('you went this way');

  const before = await page.locator('.toc a').count();
  await taken.click();
  await expect(page.locator('article.prose')).toContainText('The steps are wet');
  await expect(page.locator('.toc a')).toHaveCount(before);

  // The road refused stays inert, because it never became history.
  await page.locator('.toc a').first().click();
  await expect(page.locator('span.gamebook-choice--refused')).toBeVisible();
});

/**
 * K2.3, raised by the owner reaching an ending with no way back short of the
 * library's per-book reset — which forgets the book rather than replaying it.
 */
test('an ending offers a new attempt, and keeps the old one', async ({ page }) => {
  await page.goto(BOOK);

  // 1 → 2 → 4 → 6, which is an ending.
  await page.getByRole('link', { name: 'turn to 2' }).click();
  await page.getByRole('link', { name: 'turn to 4' }).click();
  await page.getByRole('link', { name: 'turn to 6' }).click();
  await expect(page.locator('article.prose')).toContainText('Your story ends here');
  await expect(page.locator('.toc a')).toHaveCount(4);

  await page.getByRole('link', { name: 'Begin again' }).click();

  // A second run reads like a second run: the rail is one entry again, and
  // section 4 is no longer offered even though the reader has seen it.
  await expect(page.locator('article.prose')).toContainText('The cellar door stands open');
  await expect(page.locator('.toc a')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'turn to 4' })).toHaveCount(0);

  // ...and the attempt survives a reload, so nothing was merely forgotten.
  await page.reload();
  await expect(page.locator('article.prose')).toContainText('The cellar door stands open');
});
