import { test, expect, type Page } from '@playwright/test';

/**
 * The claim this whole feature makes: a reader on a train can reload and keep
 * reading. Asserted by actually cutting the network, because a service worker
 * that registers cleanly and serves nothing is the classic way for offline
 * support to be "done" and not work.
 *
 * Runs against a built site — see `playwright.offline.config.ts`.
 */

/** Resolves once a worker controls the page, which is when caching starts. */
async function waitForController(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 30_000,
  });
}

test('a reader who has opened a book can reload it with no network', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await waitForController(page);

  // Read a chapter while online, so its chunks are in the cache. This is the
  // scope the spec promises: the shell, plus books the reader has opened.
  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  // Named content rather than a snapshot of the whole article. Comparing the
  // full text online and offline looked stricter and was merely flaky: islands
  // mount asynchronously, so the two captures raced the quiz rendering.
  await expect(page.getByRole('heading', { name: 'Getting started', level: 1 })).toBeVisible();
  await expect(page.locator('article.prose')).toContainText('Test yourself');

  // The sidebar too: a chapter with no way out of it is not a reader.
  await expect(page.locator('.sidebar__list a').first()).toBeVisible();

  // And the interactivity, which is the whole point of the format. A book that
  // goes read-only on a train is a PDF with extra steps.
  await expect(page.locator('.island--quiz').first()).toBeVisible();
});

test('the shelf still opens offline, and its books are still listed', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/#/');

  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  // Bundled books are compiled into the shell, so they are readable offline
  // whether or not the reader has opened them.
  await expect(page.locator('.shelf__card')).not.toHaveCount(0);
});

test('navigating to a chapter offline works, because routing is local', async ({
  page,
  context,
}) => {
  await page.goto('/#/guide/01-getting-started');
  await waitForController(page);
  await expect(page.locator('article.prose')).toBeVisible();
  await page.goto('/#/guide/02-interactivity-toolkit');
  await expect(page.locator('article.prose')).toBeVisible();

  await context.setOffline(true);

  // A hash change is not a network request, but the chunk behind it might be.
  await page.locator('.sidebar__list a').first().click();
  await expect(page.locator('article.prose')).toBeVisible();
});

/**
 * A reader arriving for the first time must not be told the app has updated —
 * it has not, it has merely installed. The strip appears only when a *new*
 * build is waiting behind one that is already controlling the page.
 */
test('does not announce an update to a reader who has just arrived', async ({ page }) => {
  await page.goto('/');
  await waitForController(page);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.locator('.app-update')).toHaveCount(0);
});

test('the worker never takes over on its own', async ({ page }) => {
  await page.goto('/');
  await waitForController(page);

  // Read the worker the build actually emitted, rather than trusting the
  // generator's unit test: this is the file the browser runs.
  const source = await page.evaluate(async () => {
    const response = await fetch(new URL('sw.js', location.href).href);
    return response.text();
  });

  expect(source.match(/skipWaiting/g)).toHaveLength(1);
  expect(source).toContain("if (event.data === 'SKIP_WAITING') self.skipWaiting();");
});

test('is installable: a manifest and an icon are served', async ({ page }) => {
  await page.goto('/');

  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(href).toBeTruthy();

  const manifest = await page.evaluate(async (path) => {
    const response = await fetch(new URL(path!, location.href).href);
    return response.json();
  }, href);

  expect(manifest.name).toBe('Smart Ebooks');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);

  // Relative, so a project page served from `/<repo>/` resolves them without
  // the build rewriting anything.
  expect(manifest.start_url).toBe('.');
  for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false);

  const icon = await page.evaluate(
    async (src) => (await fetch(new URL(src, location.href).href)).status,
    manifest.icons[0].src,
  );
  expect(icon).toBe(200);
});
