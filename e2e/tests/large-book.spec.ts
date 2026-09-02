import { test, expect, type Page } from '@playwright/test';
import {
  LARGE_BOOK,
  chapterTitle,
  makeLargeBookFile,
  partTitle,
  sectionTitle,
} from '../fixtures/largeBook';

/**
 * The reader, against books the size of real ones.
 *
 * Everything asserted here was *fixed* before it could be tested: the bundled
 * books are too small to overflow anything, so the failures were found by
 * reading CSS rather than by running the suite. These tests exist so the next
 * regression is caught by a machine instead.
 */

const FLAT = 'A Flat Book Of Many Chapters';
const PARTED = 'A Book In Five Divisions';

let flatPath: string;
let partedPath: string;

test.beforeAll(() => {
  flatPath = makeLargeBookFile({ title: FLAT, parts: 0 });
  partedPath = makeLargeBookFile({ title: PARTED, parts: LARGE_BOOK.parts });
});

async function open(page: Page, path: string, title: string) {
  await page.goto('/');
  await page.locator('[data-testid="import-book-input"]').setInputFiles(path);
  // A plain string is a substring match here, so no RegExp is needed.
  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: chapterTitle(1) })).toBeVisible();
}

test('a flat book keeps its whole chapter list reachable', async ({ page }) => {
  await open(page, flatPath, FLAT);

  const sidebar = page.locator('.sidebar');
  const box = await sidebar.boundingBox();
  const viewport = page.viewportSize();

  // Clamped to the viewport…
  expect(box.height).toBeLessThanOrEqual(viewport.height);

  // …and — the half a small book cannot prove — really overflowing, so the
  // clamp is load-bearing rather than incidentally satisfied. A book *with*
  // parts rarely gets here, because folding them away keeps the list short;
  // this flat shape is what the clamp actually protects.
  const overflow = await sidebar.evaluate((el) => ({
    scroll: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(overflow.scroll).toBeGreaterThan(overflow.client);

  // The last chapter is reachable. Without a scrollport of its own this link
  // exists in the DOM and cannot be clicked, because page scrolling moves the
  // article and leaves the sticky pane exactly where it is.
  const last = sidebar.getByRole('link', { name: chapterTitle(LARGE_BOOK.chapters) });
  await last.scrollIntoViewIfNeeded();
  await last.click();

  await expect(
    page.getByRole('heading', { name: chapterTitle(LARGE_BOOK.chapters) }),
  ).toBeVisible();
});

test('a parted book shows one division at a time, not all forty-four chapters', async ({
  page,
}) => {
  await open(page, partedPath, PARTED);
  const sidebar = page.locator('.sidebar');

  await expect(sidebar.locator('.sidebar__part-toggle')).toHaveCount(LARGE_BOOK.parts);
  await expect(sidebar.locator('.sidebar__part-toggle[aria-expanded="true"]')).toHaveCount(1);

  // Roughly a fifth of the chapters, and — the point of folding — few enough
  // that the list no longer needs to scroll at all.
  const visible = await sidebar.locator('.sidebar__list a:visible').count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(LARGE_BOOK.chapters / 2);

  // Reaching the last chapter costs one extra click, and works.
  await sidebar.getByRole('button', { name: partTitle(LARGE_BOOK.parts) }).click();
  await sidebar.getByRole('link', { name: chapterTitle(LARGE_BOOK.chapters) }).click();
  await expect(
    page.getByRole('heading', { name: chapterTitle(LARGE_BOOK.chapters) }),
  ).toBeVisible();
});

test('the contents rail scrolls itself to keep up with the reader', async ({ page }) => {
  await open(page, flatPath, FLAT);

  const rail = page.locator('.toc');
  const list = page.locator('.toc__list');
  await expect(list.getByRole('link')).toHaveCount(LARGE_BOOK.sectionsInFirstChapter);

  // The rail overflows — otherwise "follows the reader" is untestable, which is
  // the state this suite was in before the fixture existed.
  const overflow = await rail.evaluate((el) => ({
    scroll: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(overflow.scroll).toBeGreaterThan(overflow.client);

  // A section in the middle: far enough down that its entry starts off the
  // bottom of the rail, but not so far that the page-bottom rule takes over
  // and correctly reports the last section instead.
  const target = sectionTitle(40);
  await page.evaluate((text) => {
    const heading = [...document.querySelectorAll('h2')].find((h) =>
      h.textContent?.startsWith(text),
    );
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 20);
  }, target);

  const active = page.locator('.toc__list a.is-active');
  await expect(active).toHaveText(target);

  // Marked active is not enough: it has to be *visible inside the rail*, which
  // is the whole point of a rail that follows.
  const railBox = await rail.boundingBox();
  const activeBox = await active.boundingBox();
  expect(activeBox.y).toBeGreaterThanOrEqual(railBox.y - 1);
  expect(activeBox.y + activeBox.height).toBeLessThanOrEqual(railBox.y + railBox.height + 1);
});

test('search still finds one chapter among forty-four', async ({ page }) => {
  await open(page, flatPath, FLAT);

  await page.keyboard.press('/');
  await page.getByPlaceholder('Search this book…').pressSequentially('chapter37unique');

  await expect(page.locator('.search-overlay__meta')).toHaveText('1 matching chapter');
  await page.locator('.search-overlay__list a').first().click();
  await expect(page.getByRole('heading', { name: chapterTitle(37) })).toBeVisible();
});
