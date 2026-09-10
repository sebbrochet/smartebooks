import { test, expect, type Page } from '@playwright/test';

/**
 * How much of a phone screen the reader spends on itself (SPEC009 T10/T11).
 *
 * The target is MkDocs Material's: one bar, icon controls, the book's text
 * starting immediately under it. Before this was written the reader spent two
 * bands — the app's header, then the engine's Contents/Search toolbar as its
 * own grid row — because the two halves of the chrome have different owners
 * and no seam between them (SPEC009 V10).
 *
 * These numbers are asserted rather than eyeballed because "feels cramped" is
 * not a thing anyone can fix twice.
 */

/** The widths of phones people actually hold, smallest first. */
const PHONES = [320, 360, 390, 420];

/**
 * Just above the 720px breakpoint, where the labels come back and the host's
 * tools cluster renders inline as text. `.reader__actions` is `nowrap`, so if
 * this range does not fit it *overflows* rather than wrapping — which is worse
 * than the problem T10 set out to fix.
 */
const TABLETS = [721, 768, 900];

/** SPEC009 T10: one bar, and a bar is not 56px of anything. */
const MAX_BAR = 56;

/**
 * SPEC009 T11 / WCAG 2.5.5. 44 is the number every touch guideline gives; the
 * AA floor is 24, which the pre-T11 buttons did not clear either.
 */
const MIN_TARGET = 44;

interface Metrics {
  width: number;
  bar: number;
  rows: number;
  toolbars: number;
  overflow: number;
  title: boolean;
  /** What `--ui-bar-h` says the bar is, which should be what the bar is. */
  token: number;
  smallest: { name: string; w: number; h: number } | null;
}

async function measure(page: Page, width: number): Promise<Metrics> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/#/guide/01-getting-started');
  await page.locator('.prose').first().waitFor();

  const header = page.locator('.reader__header');
  const bar = (await header.boundingBox())?.height ?? 0;

  // Wrapping shows up as controls on more than one row: collect the distinct
  // `top` values of everything in the header. One row means one number.
  const tops = await header
    .locator('a, button')
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => (n as HTMLElement).offsetParent !== null)
        .map((n) => Math.round(n.getBoundingClientRect().top)),
    );

  const targets = await header.locator('a, button').evaluateAll((nodes) =>
    nodes
      .filter((n) => (n as HTMLElement).offsetParent !== null)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return {
          name: (n.getAttribute('aria-label') ?? n.textContent ?? '?').trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }),
  );

  return {
    width,
    bar: Math.round(bar),
    rows: new Set(tops).size,
    toolbars: await page.locator('.reader__toolbar').count(),
    // Anything sticking out past the viewport. A bar that overflows gives the
    // whole document a horizontal scrollbar, which on a phone is how a reader
    // loses the right-hand edge of every paragraph.
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
    title: await page.locator('.reader__booktitle').isVisible(),
    /*
     * Read from the element's **inline** style, not the computed value.
     *
     * `ReaderBar` measures itself and publishes the result; the stylesheet
     * carries a fallback of the same 45px. So a computed read cannot tell a
     * working measurement from a broken one that fell back to a number which
     * happens to be right today — proved by disabling the effect and watching
     * this test pass. The inline property is empty unless the effect ran, so
     * this asserts the mechanism rather than a coincidence (SPEC009 V13).
     */
    token: await page.evaluate(() =>
      Math.round(parseFloat(document.documentElement.style.getPropertyValue('--ui-bar-h') || '0')),
    ),
    smallest: targets.sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? null,
  };
}

test('the reader spends one bar on itself, not two', async ({ page }) => {
  const all: Metrics[] = [];
  for (const width of [...PHONES, ...TABLETS]) all.push(await measure(page, width));

  // Printed whichever way the assertions go: the point of this test is the
  // numbers, and a failure that only says "expected 2 to be 0" wastes them.
  // Written straight to stdout rather than through `console`, which the lint
  // rules reserve for warnings and errors — this is neither.
  const rows = all.map(
    (m) =>
      `  ${String(m.width).padStart(4)}px  bar ${String(m.bar).padStart(3)}px` +
      `  rows ${m.rows}  toolbars ${m.toolbars}  overflow ${m.overflow}` +
      `  --ui-bar-h ${m.token}` +
      `  title ${m.title ? 'shown' : 'hidden'}` +
      `  smallest ${m.smallest?.w}x${m.smallest?.h}`,
  );
  process.stdout.write(`SPEC009 T10/T11 — chrome density\n${rows.join('\n')}\n`);

  for (const m of all) {
    expect(m.toolbars, `${m.width}px: the separate toolbar row should be gone`).toBe(0);
    expect(m.bar, `${m.width}px: header height`).toBeLessThanOrEqual(MAX_BAR);
    expect(m.rows, `${m.width}px: header controls should sit on one row`).toBe(1);
    expect(m.overflow, `${m.width}px: the bar should not overflow the viewport`).toBe(0);
    // The three sticky offsets are only as right as this number is — and it is
    // only right if the bar actually measured itself, not if the fallback
    // happened to match.
    expect(m.token, `${m.width}px: --ui-bar-h should be published from the bar's own height`).toBe(
      m.bar,
    );
    expect(
      m.smallest?.h ?? 0,
      `${m.width}px: smallest control "${m.smallest?.name}"`,
    ).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(
      m.smallest?.w ?? 0,
      `${m.width}px: smallest control "${m.smallest?.name}"`,
    ).toBeGreaterThanOrEqual(MIN_TARGET);
  }

  /*
   * The title is the one thing allowed to lose (T10). Six 44px controls leave
   * 56px at 320px — three characters and an ellipsis, which reads as breakage
   * rather than as a title — so it stays hidden there and appears once there is
   * room for a word of it.
   */
  expect(all.find((m) => m.width === 320)?.title, '320px: no room for a title').toBe(false);
  for (const m of all.filter((x) => x.width >= 360)) {
    expect(m.title, `${m.width}px: the book title should be shown`).toBe(true);
  }
});

/**
 * SPEC009 T12. The progress dashboard was three sentences in a wrapping flex
 * row, so it took two rows and 90px on every phone against 50px on a desktop.
 * The stats were the same width at both — they are sized by their own text —
 * which is why the fix is a grid rather than a smaller font.
 */
test('the progress dashboard is one row, at every width', async ({ page }) => {
  const out: string[] = [];

  for (const width of [320, 360, 390, 420, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/#/guide/01-getting-started');
    const dash = page.locator('.dashboard');
    await dash.waitFor();

    const tops = await dash
      .locator('.dashboard__stat')
      .evaluateAll((nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().top)));
    const height = Math.round((await dash.boundingBox())?.height ?? 0);

    out.push(`  ${String(width).padStart(4)}px  height ${height}  rows ${new Set(tops).size}`);
    expect(tops.length, `${width}px: three stats`).toBe(3);
    expect(new Set(tops).size, `${width}px: the stats should sit on one row`).toBe(1);
  }

  process.stdout.write(`SPEC009 T12 — dashboard\n${out.join('\n')}\n`);
});

/**
 * SPEC009 T13. The breakpoint is written down twice — a media query in
 * `reader.css` and `NARROW` in `useMediaQuery.ts` — because some of what it
 * changes is markup rather than paint, and that half cannot live in CSS without
 * lying to assistive technology. Nothing held the two copies together but a
 * comment saying they must match, and a comment is not a mechanism.
 *
 * Asserted through their consequences rather than by reading the literals back:
 * the stylesheet's answer is whether `.reader__body` has collapsed to one
 * column, the script's answer is whether the rail has grown a fold control.
 * They must agree about every shape, or there is a band of viewports where the
 * rail is open above a chapter the grid has already made narrow.
 */
test('the breakpoint means the same thing to the stylesheet and to the script', async ({
  page,
}) => {
  await page.goto('/#/guide/01-getting-started');
  await page.locator('.prose').first().waitFor();

  // Around 720 on the width axis, around 600 on the height axis, plus the
  // shapes real hardware actually has.
  const shapes: [number, number][] = [
    [1400, 900],
    [1024, 768],
    [900, 800],
    [721, 800],
    [720, 800],
    [719, 800],
    [400, 800],
    [1280, 601],
    [1280, 600],
    [1280, 599],
    [844, 390],
    [740, 360],
    [390, 844],
  ];

  const disagreements: string[] = [];
  const out: string[] = [];

  for (const [width, height] of shapes) {
    await page.setViewportSize({ width, height });
    // The drawer animates; measuring mid-slide reads a state neither side holds.
    await page.waitForTimeout(300);

    const oneColumn = await page
      .locator('.reader__body')
      .evaluate((n) => getComputedStyle(n).gridTemplateColumns.trim().split(/\s+/).length === 1);
    const foldable = (await page.locator('.toc__toggle').count()) > 0;

    out.push(
      `  ${String(width).padStart(4)}×${String(height).padEnd(4)} css ${oneColumn ? 'narrow' : 'wide  '}  js ${foldable ? 'narrow' : 'wide'}`,
    );
    if (oneColumn !== foldable) {
      disagreements.push(`${width}×${height}: stylesheet ${oneColumn}, script ${foldable}`);
    }
  }

  process.stdout.write(`SPEC009 T13 — breakpoint agreement\n${out.join('\n')}\n`);
  expect(disagreements).toEqual([]);
});

/**
 * SPEC009 V15, the symptom that sent T13 looking. A phone turned on its side is
 * 844px wide and 390px tall; the width-only breakpoint called that a desk, so
 * the sidebar left its drawer and the rail unfolded into the row above the
 * chapter. Between them they took the chapter off the first screen.
 *
 * Measured before the fix at 844×390: `main` began at y=231 of 390, and the
 * reading area was 84,588px² against 153,615px² on a 667×375 screen that has
 * fewer pixels in total.
 */
test('a phone on its side still opens on the chapter', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/#/guide/01-getting-started');
  await page.locator('.prose').first().waitFor();

  const main = (await page.locator('.reader__main').boundingBox())?.y ?? 0;
  const sidebar = await page
    .locator('.sidebar')
    .evaluate((n) => Math.round(n.getBoundingClientRect().right));
  const first = await page
    .locator('article.prose p')
    .first()
    .evaluate((n) => Math.round(n.getBoundingClientRect().top));

  process.stdout.write(
    `SPEC009 V15 — 844×390\n  chrome above the chapter ${Math.round(main)}px\n` +
      `  sidebar right edge ${sidebar}px\n  first paragraph at y=${first}\n`,
  );

  expect(sidebar, 'the sidebar should be off-canvas, not holding a column').toBeLessThanOrEqual(0);
  expect(main, 'the chrome should not take half of a 390px screen').toBeLessThan(195);
  expect(first, 'the first paragraph should be on the first screen').toBeLessThan(390);
});

test('the way back to the shelf survives on a phone', async ({ page }) => {
  // The brand link was the only route back to the library, and an icon bar is
  // exactly where it would get lost.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/#/guide/01-getting-started');

  const home = page.getByRole('link', { name: /library/i });
  await expect(home).toBeVisible();
  await home.click();
  await expect(page.locator('.bookshelf, .shelf').first()).toBeVisible();
});
