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

test('the contents rail lists the sections and jumps to one', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');

  const toc = page.locator('.toc');
  await expect(toc).toBeVisible();
  await expect(toc.getByRole('link', { name: 'Why islands?' })).toBeVisible();

  // A quiz writes its questions as `###`. They are headings in the source and
  // never headings on the page, because the island replaces its own body — so
  // listing them would offer the reader links that scroll nowhere.
  await expect(toc.getByRole('link', { name: /What does a .token. represent/ })).toHaveCount(0);

  await toc.getByRole('link', { name: 'Watch it in action' }).click();
  await expect(page).toHaveURL(/#\/guide\/01-getting-started\?s=watch-it-in-action$/);

  // Still in the chapter, scrolled down it — not navigated away by a bare
  // fragment colliding with the hash route.
  await expect(
    page.getByRole('heading', { name: 'Getting started with smart ebooks' }),
  ).toBeAttached();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('a section can be linked to directly and survives a reload', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');

  const heading = page.locator('h2#watch-it-in-action');
  await expect(heading.locator('a.heading-anchor')).toHaveAttribute(
    'href',
    '#/guide/01-getting-started?s=watch-it-in-action',
  );

  await page.goto('/#/guide/01-getting-started?s=watch-it-in-action');
  await expect(heading).toBeInViewport();
});

test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 420, height: 780 } });

  test('the chapter list is a drawer, not a wall in front of the text', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    // The whole point: the reader meets the chapter, not forty links to other
    // chapters. The heading is on screen without scrolling past navigation.
    await expect(
      page.getByRole('heading', { name: 'Getting started with smart ebooks' }),
    ).toBeInViewport();

    const toggle = page.getByRole('button', { name: /Contents/ });
    const sidebar = page.locator('.sidebar');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar).toBeVisible();

    // Choosing a chapter both navigates and puts the text back in front.
    await sidebar.getByRole('link', { name: 'The interactivity toolkit' }).click();
    await expect(page).toHaveURL(/02-interactivity-toolkit/);
    await expect(sidebar).toBeHidden();
  });

  test('escape closes the drawer and hands focus back', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    const toggle = page.getByRole('button', { name: /Contents/ });
    await toggle.click();
    await expect(page.locator('.sidebar')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.sidebar')).toBeHidden();

    // Focus left on a panel that no longer exists would send the next Tab back
    // to the top of the document.
    await expect(toggle).toBeFocused();
  });
});

test('a long chapter offers a way back to the top', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');

  const button = page.getByRole('button', { name: /Top/ });
  await expect(button).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(button).toBeVisible();

  await button.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // The viewport moving without the focus point moving strands a keyboard
  // reader: the next Tab would carry on from the bottom of the chapter.
  await expect(page.locator('#main')).toBeFocused();
});

test('the contents rail tracks the section being read', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  const active = page.locator('.toc__list a.is-active');

  // Nothing is marked while the reader is still above the first section: the
  // rail should not claim they are somewhere they have not reached.
  await expect(active).toHaveCount(0);

  // Put the heading just past the line. Note that merely making it *visible*
  // is not enough and should not be: a heading sitting at the bottom of the
  // screen belongs to a section the reader has not started.
  await page.evaluate(() => {
    const el = document.getElementById('watch-it-in-action');
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
  });
  await expect(active).toHaveText('Watch it in action');
  await expect(active).toHaveAttribute('aria-current', 'true');

  // The last section's heading can never reach the line, because the section
  // is shorter than a screen — without the bottom case it is unreachable.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(active).toHaveText('Still on the roadmap');
});

test('both rails scroll on their own instead of running off the screen', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');

  // A pane taller than the viewport with no scrollport of its own has an
  // unreachable lower half — the page scroll moves the article, not the pane.
  for (const selector of ['.sidebar', '.toc']) {
    const box = await page.locator(selector).boundingBox();
    const viewport = page.viewportSize();
    expect(box, selector).not.toBeNull();
    expect(box.height, selector).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator(selector)).toHaveCSS('overflow-y', 'auto');
  }
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
