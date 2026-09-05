import { test, expect, type Locator } from '@playwright/test';

/**
 * Whether a reader could actually press this control.
 *
 * Not `isVisible()`. That returns **true** for the closed navigation drawer at
 * every width down to 320px, because the drawer is moved out of frame with a
 * transform and `isVisible` only asks about `display`, `visibility` and a
 * non-empty box — all of which an off-screen element still satisfies. A test
 * written on it passes whatever the stylesheet says, which is worse than no
 * test: it reports a guarantee it is not making.
 *
 * So: on screen, and the thing a tap at its centre would land on.
 */
async function reachable(locator: Locator) {
  if ((await locator.count()) === 0 || !(await locator.isVisible())) return false;

  const box = await locator.boundingBox();
  const view = locator.page().viewportSize();
  if (!box || !view) return false;

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (x < 0 || y < 0 || x > view.width || y > view.height) return false;

  return locator.evaluate(
    (el, at) => {
      const hit = document.elementFromPoint(at.x, at.y);
      return !!hit && (el === hit || el.contains(hit) || hit.contains(el));
    },
    { x, y },
  );
}

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
  // The chapters, specifically: the part heading also carries a link to the
  // part's own overview page, and counting every link in the group would make
  // this assertion drift the next time the heading gains a control.
  await expect(partOne.locator('.sidebar__list a')).toHaveCount(2);
  await expect(partOne.getByRole('link', { name: /A chess game, move by move/ })).toBeVisible();
  // Grouping is presentation only — the chapters are still one flat sequence,
  // so navigation across a part boundary is an ordinary next step. Part II is
  // folded away while Part I is being read, so it has to be opened first.
  await sidebar.getByRole('button', { name: 'Part II — Writing one' }).click();
  await sidebar.getByRole('link', { name: /A game from a file/ }).click();
  await expect(page).toHaveURL(/03-a-game-from-a-file/);

  // The guide declares no parts and must render exactly as it always did.
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('.sidebar .sidebar__part')).toHaveCount(0);
  await expect(page.locator('.sidebar__list > li')).toHaveCount(3);
});

test('only the part being read is unfolded', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  const sidebar = page.locator('.sidebar');

  const one = sidebar.getByRole('button', { name: 'Part I — Reading a game' });
  const two = sidebar.getByRole('button', { name: 'Part II — Writing one' });

  // Listing every chapter of every part is a wall on a real book: the
  // comparison book shows 30 of its 44 links, the rest folded away.
  await expect(one).toHaveAttribute('aria-expanded', 'true');
  await expect(two).toHaveAttribute('aria-expanded', 'false');
  await expect(sidebar.getByRole('link', { name: /A game from a file/ })).toBeHidden();

  await two.click();
  await expect(two).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar.getByRole('link', { name: /A game from a file/ })).toBeVisible();

  // Closing the part you are reading is allowed — it is the reader's list —
  // and it sticks while they stay put.
  await one.click();
  await expect(one).toHaveAttribute('aria-expanded', 'false');

  // …but moving to another chapter unfolds the part that chapter is in, even
  // when it is the same part. The invariant is that the list never hides the
  // chapter you are on; a next-chapter link inside a closed part would.
  await page.goto('/#/chess/02-reading-an-annotated-game');
  await expect(sidebar.getByRole('button', { name: 'Part I — Reading a game' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
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

  test('the header is one row, with the rest of the controls behind it', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    // It wrapped to 154px of a 780px screen: a fifth of the viewport spent on
    // controls a reader touches once a month, before a word of the book.
    const header = await page.locator('.reader__header').boundingBox();
    expect(header.height).toBeLessThan(70);

    const tools = page.locator('.reader__tools');
    await expect(tools).toBeHidden();

    // The theme toggle stays out — it is the one control used while reading.
    await expect(page.getByRole('button', { name: /Theme:/ })).toBeVisible();

    await page.getByRole('button', { name: /Tools/ }).click();
    await expect(tools).toBeVisible();
    await expect(tools.getByRole('button', { name: 'Reset progress' })).toBeVisible();

    // Opening the panel must not push the chapter down; it floats over it.
    const afterOpen = await page.locator('.reader__header').boundingBox();
    expect(afterOpen.height).toBe(header.height);
  });

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

  test('the contents rail is folded away, not stacked on top of the chapter', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');

    const toggle = page.getByRole('button', { name: 'On this page' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.toc__list')).toBeHidden();

    // The measurement that motivated this: with the list always open, the
    // chapter title sat at y=632 of a 780px screen and no prose was visible.
    const title = await page.locator('.prose h1').boundingBox();
    expect(title.y).toBeLessThan(420);

    await toggle.click();
    await expect(page.locator('.toc__list')).toBeVisible();
    await expect(
      page.locator('.toc__list').getByRole('link', { name: 'Watch it in action' }),
    ).toBeVisible();
  });

  test('search is a tap away, not folded into the drawer', async ({ page }) => {
    await page.goto('/#/guide/01-getting-started');
    await expect(page.locator('article.prose')).toBeVisible();

    // The sidebar's search is inside the drawer at this width, so it is not the
    // control a reader can reach — the toolbar's is.
    await expect(page.locator('.sidebar__search')).toBeHidden();

    const search = page.locator('.reader__search-toggle');
    await expect(search).toBeVisible();

    // …and it opens the same overlay `/` does. A phone has no `/` key to press,
    // which is the whole reason this button exists.
    await search.click();
    const input = page.getByPlaceholder('Search this book…');
    await expect(input).toBeFocused();
    await input.pressSequentially('matching', { delay: 40 });
    await expect(page.locator('.search-overlay__list li')).not.toHaveCount(0);
  });
});

/**
 * The handover between the two search controls, measured at the breakpoint.
 *
 * Neither control is visible at every width by design: above 720px search sits
 * in the sidebar, below it in the toolbar, and each is hidden where the other
 * takes over. That is fine until the two rules disagree about *where* 720px
 * is, and then there is a band of widths with no way into search at all —
 * invisible to every other test here, because they all run at one width.
 *
 * So this asserts the union rather than either control: at every width, a
 * reader can start a search.
 */
test('there is no width where search cannot be reached', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();

  const widths = [1400, 1100, 1000, 900, 800, 760, 740, 721, 720, 719, 600, 400, 320];
  const unreachable: number[] = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    // The drawer animates; measuring mid-slide reads a position neither state
    // ever holds.
    await page.waitForTimeout(350);

    const sidebar = await reachable(page.locator('.sidebar__search'));
    const toolbar = await reachable(page.locator('.reader__search-toggle'));
    if (!sidebar && !toolbar) unreachable.push(width);
  }

  expect(unreachable).toEqual([]);
});

test('on a wide screen the controls are all in the header, with no disclosure', async ({
  page,
}) => {
  await page.goto('/#/guide/01-getting-started');

  await expect(page.getByRole('button', { name: /Tools/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset progress' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export progress' })).toBeVisible();
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

test('search happens over the book and gives the reader their place back', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  // The `/` handler is mounted by the reader, so pressing it before the chapter
  // exists races the first render rather than testing anything.
  await expect(page.locator('article.prose')).toBeVisible();

  // Somewhere into the chapter, so losing the position would be noticeable.
  await page.evaluate(() => window.scrollTo(0, 900));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);

  // `/` from anywhere, the convention every documentation site shares.
  await page.keyboard.press('/');
  const input = page.getByPlaceholder('Search this book…');
  await expect(input).toBeFocused();

  // Results per keystroke — no Enter, no navigation.
  await input.pressSequentially('matching', { delay: 40 });
  await expect(page.locator('.search-overlay__list li')).not.toHaveCount(0);
  await expect(page.locator('.search-overlay__meta')).toContainText(/matching passages?/);

  // The terms are marked in the results rather than left for the reader to
  // find in a wall of grey snippet.
  await expect(page.locator('.search-overlay mark').first()).toHaveText(/matching/i);

  // Escape returns to the chapter *and* the place in it.
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-overlay__panel')).toHaveCount(0);
  await expect(page).toHaveURL(/01-getting-started/);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test('the keyboard alone can find a chapter and open it', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();

  await page.keyboard.press('/');
  await page.getByPlaceholder('Search this book…').pressSequentially('progress', { delay: 40 });

  const options = page.locator('.search-overlay__list li');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Enter');
  await expect(page.locator('.search-overlay__panel')).toHaveCount(0);
  await expect(page.locator('article.prose')).toBeVisible();
});

test('a search result opens the chapter it names', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');

  await page.locator('.sidebar__search').click();
  await page.getByPlaceholder('Search this book…').fill('matching');

  const first = page.locator('.search-overlay__list a').first();
  await expect(first).toBeVisible();
  await first.click();

  await expect(page.locator('.search-overlay__panel')).toHaveCount(0);
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
