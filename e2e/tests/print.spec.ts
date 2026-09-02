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
});
