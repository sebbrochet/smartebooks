import { test, expect } from '@playwright/test';

/**
 * The stylesheet named `Inter` and `JetBrains Mono` for a long time without
 * loading either, so both silently fell through to whatever the platform
 * supplied. Naming a family proves nothing; this asks the browser.
 */
test('the reading fonts are actually loaded, and from this origin', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') requests.push(request.url());
  });

  await page.goto('/#/football/01-the-basics');
  await page.evaluate(() => document.fonts.ready);

  // Loaded, not merely declared.
  const loaded = await page.evaluate(() => [...document.fonts].map((face) => face.family));
  expect(loaded).toContain('Inter Variable');

  // And used: the resolved stack starts with the family we ship.
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family.startsWith('"Inter Variable"') || family.startsWith('Inter Variable')).toBe(true);

  // Self-hosted: no font CDN is contacted, which is the same promise the video
  // island makes. Fonts come from the app's own origin or not at all.
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  }
});

test('the reader can set their own type, and it outlives the visit', async ({ page }) => {
  await page.goto('/#/football/01-the-basics');
  await expect(page.locator('article.prose')).toBeVisible();

  const size = () =>
    page
      .locator('.prose p')
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize);
  const before = await size();

  await page.getByRole('button', { name: /Reading/ }).click();

  // Clicking the label, which is what the reader clicks: the radio itself is
  // visually hidden beneath it and exists to make this a real radio group for
  // the keyboard and for a screen reader.
  const choose = (label: string) =>
    page.locator('.reading-settings__options label', { hasText: label }).click();

  await choose('Extra large');
  await expect(page.getByRole('radio', { name: 'Extra large' })).toBeChecked();

  const enlarged = await size();
  expect(parseFloat(enlarged)).toBeGreaterThan(parseFloat(before));

  // Serif is a *system* stack, so assert the family changed rather than
  // naming a font the test machine may not have.
  const sans = await page
    .locator('.prose p')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  await choose('Serif');
  const serif = await page
    .locator('.prose p')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(serif).not.toBe(sans);

  // Someone who needs larger text needs it in every book and on every visit;
  // being asked again is the same failure as not having the setting.
  await page.reload();
  await expect(page.locator('article.prose')).toBeVisible();
  expect(await size()).toBe(enlarged);

  // …and in another book, because this describes an eye and not a book.
  await page.goto('/#/chess/01-chess-basics');
  await expect(page.locator('article.prose')).toBeVisible();
  expect(await size()).toBe(enlarged);
});

test('the reading panel closes on Escape and hands focus back', async ({ page }) => {
  await page.goto('/#/football/01-the-basics');
  await expect(page.locator('article.prose')).toBeVisible();

  const toggle = page.getByRole('button', { name: /Reading/ });
  await toggle.click();
  await expect(page.locator('.reading-settings__panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.reading-settings__panel')).toBeHidden();
  await expect(toggle).toBeFocused();
});

test('the pre-1.0 theme key migrates to the namespaced one', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smart-ebook-theme', 'dark'));
  await page.goto('/');

  // The no-FOUC script still honours the old key, so there is no theme flash.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // …and the value moves to the namespaced key, with the old one removed.
  const [migrated, legacy] = await page.evaluate(() => [
    localStorage.getItem('smart-ebooks:theme'),
    localStorage.getItem('smart-ebook-theme'),
  ]);
  expect(migrated).toBe('dark');
  expect(legacy).toBeNull();
});

test('every bundled book renders its packaged cover', async ({ page }) => {
  await page.goto('/');

  const items = page.locator('main li');
  const covers = page.locator('main li img.bookcover');
  // The shelf resolves every cover to a Blob URL before it paints, which is
  // slow enough on a loaded machine to outlast the default timeout.
  await expect(items).not.toHaveCount(0, { timeout: 20_000 });
  // Counted rather than named, so adding a book to the shelf without artwork
  // fails here instead of quietly showing a title card.
  await expect(covers).toHaveCount(await items.count());

  // Packaged bytes resolve to a Blob URL, which is what gives an SVG cover its
  // MIME type; a plain path would render as a broken image.
  const sources = await covers.evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).getAttribute('src')),
  );
  for (const src of sources) expect(src).toMatch(/^blob:/);

  // The generated title card is for an imported book with no artwork. Both
  // branches are covered in BookCover.test.tsx; what matters here is that no
  // bundled book is relying on it.
  await expect(page.locator('.bookcover--generated')).toHaveCount(0);
});
