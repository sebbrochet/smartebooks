import { test, expect } from '@playwright/test';

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
