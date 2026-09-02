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

  await page.goto('/#/guide/01-getting-started');
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
  await page.goto('/#/guide/01-getting-started');
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
  await page.goto('/#/guide/01-getting-started');
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

test('a bundled book renders its packaged cover, and others fall back', async ({ page }) => {
  await page.goto('/');

  // The guide packages assets/cover.svg, so it resolves to a Blob URL…
  const guide = page.getByRole('link', { name: /The Smart Ebook Guide/ });
  await expect(guide.locator('img.bookcover')).toHaveAttribute('src', /^blob:/);

  // …while a book without artwork gets a generated title card instead.
  const chess = page.getByRole('link', { name: /Chess/ });
  await expect(chess.locator('.bookcover--generated')).toBeVisible();
});

test('a bundled book resolves packaged media to a Blob URL', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');

  // Packaged media is base-path independent and travels with a .smartbook export.
  const audio = page.locator('.island--audio audio');
  await expect(audio).toHaveAttribute('src', /^blob:/);

  // The clip is really decodable, not just a Blob of the wrong bytes.
  const duration = await audio.evaluate(
    (el: HTMLAudioElement) =>
      new Promise<number>((resolve, reject) => {
        if (el.readyState > 0) return resolve(el.duration);
        el.addEventListener('loadedmetadata', () => resolve(el.duration), { once: true });
        el.addEventListener('error', () => reject(new Error('audio failed to load')), {
          once: true,
        });
      }),
  );
  expect(duration).toBeGreaterThan(0);
});
