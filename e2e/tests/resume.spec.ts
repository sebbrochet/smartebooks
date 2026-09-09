import { test, expect } from '@playwright/test';

const CHAPTER = '/#/guide/02-interactivity-toolkit';

test('returning to the site resumes the last book and chapter', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.getByRole('heading', { name: /interactivity/i }).first()).toBeVisible();

  // Come back to the bare entry URL, as a returning reader would.
  await page.goto('/');
  await expect(page).toHaveURL(/02-interactivity-toolkit/);
});

test('resume returns to the place, not just to the chapter', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();

  // Read down to a section, and pause long enough for the position to be
  // written — it is deliberately not saved on every scroll frame.
  await page.evaluate(() => {
    const heading = document.getElementById('play-a-matching-game');
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY + 40);
  });
  const left = await page.evaluate(() => window.scrollY);
  expect(left).toBeGreaterThan(0);
  await page.waitForTimeout(1200);

  // Come back the way a returning reader does. Note *not* via `#/`: asking
  // for the library is a choice the app deliberately remembers, and it
  // suppresses resume.
  await page.goto('/');
  await expect(page).toHaveURL(/01-getting-started/);

  // Within a line or two of where they stopped. Returning to the chapter but
  // not the place is most of the way to not resuming at all.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(left - 60);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(left + 60);
});

test('a deep link wins over a remembered place', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(1200);

  // Asking for a section must not be overruled by where this reader happened
  // to stop last time.
  await page.goto('/#/guide/01-getting-started?s=test-yourself');
  await expect(page.locator('h2#test-yourself')).toBeInViewport();
});

test('a deep link is never hijacked by resume', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page).toHaveURL(/02-interactivity-toolkit/);

  // A different book, linked directly, must win over the resume pointer.
  await page.goto('/#/chess/01-chess-basics');
  await expect(page).toHaveURL(/chess/);
  await expect(page.getByRole('heading', { name: /A chess game, move by move/ })).toBeVisible();
});

test('choosing the library keeps you there, even after a refresh', async ({ page }) => {
  await page.goto(CHAPTER);
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});

test('the "always show my library" preference disables resume', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('resume-mode').selectOption('shelf');

  await page.goto(CHAPTER);
  await expect(page).toHaveURL(/02-interactivity-toolkit/);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});

/**
 * The gap a reader reported, and the one the feature's name promises hardest:
 * going back to the library and opening the same book again started it at
 * chapter one.
 *
 * Nothing here is a fresh page load, so the launch decision — which is
 * evaluated once and only ever redirects `#/` — never applies. Opening a book
 * at `#/<slug>` simply rendered its first chapter, because that is what "no
 * chapter in the route" had always meant.
 */
test('opening a book from the library returns to the chapter you were reading', async ({
  page,
}) => {
  await page.goto(CHAPTER);
  await expect(page.locator('article.prose')).toBeVisible();
  // The position is written on a delay, not on every scroll frame.
  await page.waitForTimeout(1200);

  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await page.getByRole('link', { name: /The Smart Ebook Guide/ }).click();

  await expect(page).toHaveURL(/02-interactivity-toolkit/);
  await expect(page.getByRole('heading', { name: 'The interactivity toolkit' })).toBeVisible();
});

/** …and a reader who has never opened the book still starts at the beginning. */
test('a book never opened starts at its first chapter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /The Smart Ebook Guide/ }).click();

  await expect(page.locator('article.prose')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Getting started', level: 1 })).toBeVisible();
});

/**
 * Resume is section-precise, and that has to survive the route above too.
 *
 * Redirecting to the chapter is only half the promise: the reader stopped
 * part-way down it. The redirect lands on `#/<slug>/<chapter>` with no `?s=`,
 * which is exactly the case the reader treats as "restore the saved spot", so
 * the two mechanisms have to meet. Nothing tested that they did — the existing
 * place-level test goes through a page load instead.
 */
test('returning through the library restores the place, not just the chapter', async ({ page }) => {
  await page.goto(CHAPTER);
  await expect(page.locator('article.prose')).toBeVisible();

  await page.evaluate(() => {
    const heading = document.getElementById('play-to-learn');
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY + 40);
  });
  const left = await page.evaluate(() => window.scrollY);
  expect(left).toBeGreaterThan(0);
  await page.waitForTimeout(1200);

  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await page.getByRole('link', { name: /The Smart Ebook Guide/ }).click();

  await expect(page).toHaveURL(/02-interactivity-toolkit/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(left - 60);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(left + 60);
});

test('cover mode shows a skippable splash before resuming', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('resume-mode').selectOption('cover');

  await page.goto(CHAPTER);
  await page.goto('/');

  const splash = page.getByTestId('cover-splash');
  await expect(splash).toBeVisible();

  // It continues on its own, but the reader can skip immediately.
  await page.getByRole('button', { name: 'Continue now' }).click();
  await expect(page).toHaveURL(/02-interactivity-toolkit/);
});

/**
 * SPEC008 G9.5 — resume must follow the pane.
 *
 * Every test above scrolls the window, because today the chapter *is* the
 * document. G9.2 puts the prose in a pane beside a fixed board, and at that
 * point `window.scrollY` stops being where the reader is: the page does not
 * move at all. Both halves of resume assumed it did — the measurement, which
 * read `window.scrollY` and never heard a pane scroll, and the restore, which
 * called `window.scrollTo` and would have moved nothing.
 *
 * The pane is made here rather than waited for, so the mechanism can be
 * settled before the layout that needs it is built (SPEC008 §7). It is one
 * rule against a real browser doing real layout, which is the part jsdom
 * cannot check.
 */
/**
 * A crude stand-in for G9.2's layout, and crude on purpose: the reading column
 * is the only thing that scrolls, and the page around it fits the screen. Both
 * halves matter. Cap the column alone and the document is still a pixel or two
 * taller than the viewport, which is enough to hide the third bug this test
 * exists to catch — "is the reader at the end", asked of a page that never
 * moves, is true from the moment the chapter opens.
 *
 * `overflow: hidden` rather than `auto` on the wrapper, so it stays a clipping
 * box and the column remains the scrollport.
 */
const PANE_CSS = `.reader__body {
  max-height: calc(100vh - 6rem) !important;
  overflow: hidden !important;
}
.reader__main {
  height: 400px !important;
  max-height: 400px !important;
  overflow-y: auto !important;
}`;

test('resume follows a pane, not the page', async ({ page }) => {
  // At document start, so the pane exists before the reader restores into it.
  // Added with `page.addStyleTag` it would be a race against the chapter.
  await page.addInitScript((css) => {
    const inject = () => {
      if (!document.documentElement) return void requestAnimationFrame(inject);
      const style = document.createElement('style');
      style.textContent = css;
      document.documentElement.appendChild(style);
    };
    inject();
  }, PANE_CSS);

  await page.goto('/#/guide/01-getting-started');
  const pane = page.locator('.reader__main');
  await expect(page.locator('article.prose')).toBeVisible();

  // Read down to a section — by scrolling the pane, which is the only thing
  // that scrolls now.
  await pane.evaluate((el) => {
    const heading = document.getElementById('play-a-matching-game');
    el.scrollTop += heading.getBoundingClientRect().top - el.getBoundingClientRect().top - 40;
  });

  const left = await pane.evaluate((el) => el.scrollTop);
  expect(left).toBeGreaterThan(0);
  // The premise: the reader has moved a long way and the page has not moved.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // The same measurement drives the contents rail, and it is where a page-only
  // reading of "has the reader reached the end?" shows up first: the document
  // no longer scrolls, so it is at its end permanently, and the rail marks the
  // *last* section from the moment the chapter opens.
  await expect(page.locator('.toc__list a[aria-current="true"]')).toHaveText(
    'Play a matching game',
  );

  // The position is written on a delay, not on every scroll frame. It is only
  // written at all if the measurement heard the pane scroll.
  await page.waitForTimeout(1200);

  await page.goto('/');
  await expect(page).toHaveURL(/01-getting-started/);

  // Within a line or two of where they stopped — in the pane.
  await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(left - 60);
  expect(await pane.evaluate((el) => el.scrollTop)).toBeLessThan(left + 60);
});
