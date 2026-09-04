import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
 * A book's own content is embedded and survives the network going away; media
 * it merely *links to* does not. SPEC003 E2.1 asks that the reader be told
 * which, rather than pressing play and watching nothing happen.
 *
 * Chapter one of the guide happens to hold one of each — a YouTube embed and a
 * packaged `.wav` — so the two cases can be asserted against each other rather
 * than in isolation.
 */
test('says which media needs a network, and stays quiet about media that does not', async ({
  page,
  context,
}) => {
  await page.goto('/#/guide/01-getting-started');
  await waitForController(page);
  await expect(page.locator('article.prose')).toBeVisible();

  // Online: no warnings anywhere. A notice that is always on says nothing.
  await expect(page.locator('.island__offline')).toHaveCount(0);

  await context.setOffline(true);

  await expect(page.locator('.island--video .island__offline')).toBeVisible();
  await expect(page.locator('.island--video')).toContainText('needs a connection');

  // The packaged clip is part of the book, so there is nothing to warn about.
  await expect(page.locator('.island--audio .island__offline')).toHaveCount(0);
  // And the play control is still there: the reader is told, not prevented.
  await expect(page.locator('.island--video .video__facade')).toBeVisible();
});

/**
 * The case above changes the connection under a page that is already open. A
 * reader on a train opens the book *already* offline, and must be told at first
 * paint rather than only when something changes.
 *
 * `navigator.onLine` is overridden rather than emulated because Playwright's
 * offline emulation **does not survive a reload** — measured: after
 * `setOffline(true)` and `page.reload()`, the new document reports `onLine:
 * true`. Real browsers do not do that, so emulating it here would test the
 * harness rather than the reader's experience.
 */
test('warns on first paint when the book is opened with no network', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false });
  });

  await page.goto('/#/guide/01-getting-started');
  await expect(page.locator('article.prose')).toBeVisible();

  await expect(page.locator('.island--video .island__offline')).toBeVisible();
  await expect(page.locator('.island--audio .island__offline')).toHaveCount(0);
});

test('drops the warning again when the network comes back', async ({ page, context }) => {
  await page.goto('/#/guide/01-getting-started');
  await waitForController(page);
  await context.setOffline(true);
  await expect(page.locator('.island--video .island__offline')).toBeVisible();

  await context.setOffline(false);
  await expect(page.locator('.island--video .island__offline')).toHaveCount(0);
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

/*
 * The update path, which is the most dangerous thing a PWA does and was until
 * now only half proven: the tests above assert that the worker *contains* no
 * unsolicited `skipWaiting`, not that the sequence a reader actually meets
 * works. Getting this wrong is how readers end up stranded on a stale shell.
 *
 * A new deployment is simulated by rewriting the version in the worker the
 * build emitted. That is exactly what a real deployment changes — the browser
 * refetches `sw.js`, sees different bytes, and installs a second worker — and
 * it avoids a second three-minute build inside the test.
 */
const SW = resolve('apps/library/dist/sw.js');
let pristine: string | undefined;

function deployNewVersion(): string {
  if (!existsSync(SW)) throw new Error(`No built worker at ${SW}. Run \`npm run build\` first.`);
  pristine ??= readFileSync(SW, 'utf8');

  const version = `updated-${Date.now()}`;
  const next = pristine.replace(/const VERSION = "[^"]*"/, `const VERSION = "${version}"`);
  if (next === pristine) throw new Error('Could not find VERSION in the generated worker.');

  writeFileSync(SW, next);
  return version;
}

// Leave the build as it was found, so a later run of this suite — or a deploy
// from the same `dist` — does not ship a worker this test edited.
test.afterAll(() => {
  if (pristine) writeFileSync(SW, pristine);
});

test('an update waits for the reader, and installs only when they ask', async ({ page }) => {
  await page.goto('/');
  await waitForController(page);
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  const before = await page.evaluate(() => caches.keys());
  expect(before.length).toBeGreaterThan(0);
  await expect(page.locator('.app-update')).toHaveCount(0);

  const version = deployNewVersion();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  // Offered, not applied.
  await expect(page.locator('.app-update')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload to update' })).toBeVisible();

  /*
   * The new worker *has* installed and precached itself by now, and that is
   * correct — it is what makes applying the update instant. What matters is
   * that it is **waiting** rather than active, and that the cache the reader is
   * being served from is untouched.
   *
   * The first version of this assertion said the caches were unchanged, which
   * was a proxy for "nothing has happened" and simply false: install precaches.
   */
  const waiting = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.waiting);
  });
  expect(waiting).toBe(true);
  expect(await page.evaluate(() => caches.keys())).toContain(before[0]);
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await page.getByRole('button', { name: 'Reload to update' }).click();

  // Now it has taken over: the page reloaded, the notice is gone, and the new
  // version's cache exists while the old one has been cleaned up.
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.locator('.app-update')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`smart-ebooks-${version}`]);
});

test('a reader who ignores the update keeps reading the version they opened', async ({ page }) => {
  await page.goto('/#/guide/01-getting-started');
  await waitForController(page);
  await expect(page.locator('article.prose')).toBeVisible();

  deployNewVersion();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  await expect(page.locator('.app-update')).toBeVisible();

  // The whole point of not calling `skipWaiting`: the shell is not swapped
  // underneath someone mid-chapter. They can still navigate the book they
  // opened, on the build they opened it with.
  await page.locator('.sidebar__list a').nth(1).click();
  await expect(page.locator('article.prose')).toBeVisible();
  await expect(page.locator('.app-update')).toBeVisible();
});
