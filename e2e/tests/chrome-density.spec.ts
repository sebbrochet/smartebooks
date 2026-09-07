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
      `  title ${m.title ? 'shown' : 'hidden'}` +
      `  smallest ${m.smallest?.w}x${m.smallest?.h}`,
  );
  process.stdout.write(`SPEC009 T10/T11 — chrome density\n${rows.join('\n')}\n`);

  for (const m of all) {
    expect(m.toolbars, `${m.width}px: the separate toolbar row should be gone`).toBe(0);
    expect(m.bar, `${m.width}px: header height`).toBeLessThanOrEqual(MAX_BAR);
    expect(m.rows, `${m.width}px: header controls should sit on one row`).toBe(1);
    expect(m.overflow, `${m.width}px: the bar should not overflow the viewport`).toBe(0);
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
