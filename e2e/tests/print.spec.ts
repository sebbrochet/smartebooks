import { test, expect } from '@playwright/test';

/**
 * Printing a chapter.
 *
 * Not the PDF export of SPEC003 — this is the thing a reader does when they
 * want the chapter in their hand. It never got styles, so `Ctrl+P` used to
 * produce the sidebar, the contents rail and a floating "Top" button over a
 * chapter squeezed into a column (SPEC009 V8/T8).
 *
 * `emulateMedia` is what makes any of this assertable: the print stylesheet is
 * otherwise only visible in a dialog no test can read.
 */
test.describe('on paper', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the chapter prints without the furniture around it', async ({ page }) => {
    await page.goto('/#/guide/03-tracking-progress');
    await expect(page.locator('article.prose')).toBeVisible();

    // Visible on screen…
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.reader__header')).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    // …and gone on paper, along with everything else that exists to navigate
    // a screen and cannot be operated on a sheet.
    for (const selector of [
      '.sidebar',
      '.toc',
      '.reader__header',
      '.reader__footer',
      '.back-to-top',
      '.dashboard',
      '.chapter-nav',
    ]) {
      await expect(page.locator(selector), selector).toBeHidden();
    }

    // The chapter itself survives, and uses the page rather than a screen
    // measure — a printed column the width of a browser reading column wastes
    // most of the sheet.
    await expect(page.locator('article.prose')).toBeVisible();
    const measure = await page
      .locator('article.prose')
      .evaluate((el) => getComputedStyle(el).maxWidth);
    expect(measure).toBe('none');
  });

  test('a dark-theme reader does not print a black page', async ({ page }) => {
    await page.goto('/#/guide/03-tracking-progress');
    await expect(page.locator('article.prose')).toBeVisible();

    // Choose dark explicitly, the way a reader would.
    const toggle = page.getByRole('button', { name: /Theme:/ });
    for (let i = 0; i < 3; i += 1) {
      if ((await page.locator('html').getAttribute('data-theme')) === 'dark') break;
      await toggle.click();
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const onScreen = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor.trim(),
    );

    await page.emulateMedia({ media: 'print' });
    const onPaper = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.querySelector('.prose p')).color,
    }));

    // The most expensive way to get a chapter wrong is white text on a full
    // black page.
    expect(onPaper.background).not.toBe(onScreen);
    expect(onPaper.background).toBe('rgb(255, 255, 255)');
    expect(onPaper.text).toBe('rgb(17, 17, 17)');
  });

  test('an external link prints its address', async ({ page }) => {
    await page.goto('/#/guide/02-interactivity-toolkit');
    await expect(page.locator('article.prose')).toBeVisible();

    const link = page.locator('.prose a[href^="http"]').first();
    await expect(link).toBeVisible();

    const before = await link.evaluate((el) => getComputedStyle(el, '::after').content);
    await page.emulateMedia({ media: 'print' });
    const after = await link.evaluate((el) => getComputedStyle(el, '::after').content);

    // A URL is unfollowable on paper unless it is written down.
    expect(before).toMatch(/none|^""$/);
    expect(after).toContain('http');

    /*
     * The matching negative — that an in-book link does *not* print
     * `#/guide/02-toolkit?s=islands` after itself — has no fixture: no bundled
     * chapter contains a prose link to another chapter, and the heading
     * anchors are `display: none` here, which would make the assertion pass
     * for the wrong reason. The rule is scoped to `[href^='http']`, so the
     * behaviour follows from the selector rather than from a test.
     */
  });

  /**
   * SPEC009 V14 / SPEC008 G9.1. A pane that scrolls on screen must print whole.
   *
   * T8 hid what cannot be operated on paper and never asked what had been
   * *clipped*. The chess book's game score kept its `max-height` on paper, so
   * it printed the slice the reader happened to be looking at — measured at
   * 287px of 362px, with 75px of moves silently absent. Nothing failed, no
   * warning appeared, and the reader would only find out holding the page.
   *
   * Asserted through `scrollHeight` rather than by eye, because "the rest of
   * the moves are missing" is invisible in a screenshot of the part that did
   * print.
   */
  test('a pane that scrolls on screen prints in full', async ({ page }) => {
    await page.goto('/#/chess/03-a-game-from-a-file');
    const score = page.locator('.chess-moves').first();
    await score.waitFor();

    // On screen it is capped, and that is deliberate: the board has to stay
    // visible while the reader works through a 23-move game.
    const onScreen = await score.evaluate((n) => ({
      clipped: n.scrollHeight > n.clientHeight,
      overflowY: getComputedStyle(n).overflowY,
    }));
    expect(onScreen.clipped, 'the score is capped on screen').toBe(true);
    expect(onScreen.overflowY).toBe('auto');

    await page.emulateMedia({ media: 'print' });

    const onPaper = await score.evaluate((n) => ({
      client: n.clientHeight,
      scroll: n.scrollHeight,
      maxHeight: getComputedStyle(n).maxHeight,
    }));

    expect(onPaper.maxHeight, 'the cap is released on paper').toBe('none');
    expect(
      onPaper.client,
      `${onPaper.scroll - onPaper.client}px of the score would not print`,
    ).toBe(onPaper.scroll);
  });

  /**
   * SPEC008 G9.2 put a second cap on the page, and C19 is what happens when a
   * new one is added without asking what it does on paper.
   *
   * A game is now a board above a pane of prose, bounded to the viewport. Two
   * boxes clip: the pane, which is a real scrollport, and the game itself,
   * whose height budget is what makes the pane scroll at all. Releasing only
   * the pane would print the game as a viewport-tall box with its annotation
   * spilling over whatever follows it.
   */
  test('a game bounded to the viewport prints whole', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/#/chess/04-a-game-you-can-lay-out');

    const game = page.getByTestId('chess-game');
    const prose = page.getByTestId('chess-game-prose');
    await game.waitFor();

    // On screen the prose is a pane, which is the whole point of G9.2.
    expect(await prose.evaluate((n) => n.scrollHeight > n.clientHeight + 1)).toBe(true);

    await page.emulateMedia({ media: 'print' });

    for (const [name, box] of [
      ['the game', game],
      ['its prose', prose],
    ] as const) {
      const onPaper = await box.evaluate((n) => ({
        client: n.clientHeight,
        scroll: n.scrollHeight,
        maxHeight: getComputedStyle(n).maxHeight,
      }));
      expect(onPaper.maxHeight, `${name}: the cap is released on paper`).toBe('none');
      expect(onPaper.client, `${name}: ${onPaper.scroll - onPaper.client}px would not print`).toBe(
        onPaper.scroll,
      );
    }
  });
});
