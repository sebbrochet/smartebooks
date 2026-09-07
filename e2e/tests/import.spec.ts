import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A 1x1 transparent PNG.
const PIXEL_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makePackageFile(): string {
  const manifest = {
    schemaVersion: 1,
    slug: 'imported-demo',
    title: 'Imported Demo Book',
    description: 'Imported at runtime.',
    cover: 'assets/cover.png',
    chapters: [{ file: '01-hello.md', order: 1 }],
    assets: ['assets/pixel.png', 'assets/cover.png'],
  };
  const pixel = new Uint8Array(Buffer.from(PIXEL_PNG_B64, 'base64'));
  const zip = zipSync({
    'smartbook.json': strToU8(JSON.stringify(manifest)),
    'content/01-hello.md': strToU8(
      '# Hello from an import\n\nThis book was imported.\n\n![pixel](assets/pixel.png)\n',
    ),
    'assets/pixel.png': pixel,
    'assets/cover.png': pixel,
  });
  const path = join(tmpdir(), `smart-ebook-import-${Date.now()}.smartbook.zip`);
  writeFileSync(path, zip);
  return path;
}

test('import a .smartbook package, then open and delete it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  await page.locator('[data-testid="import-book-input"]').setInputFiles(makePackageFile());

  const card = page.getByRole('link', { name: /Imported Demo Book/ });
  await expect(card).toBeVisible();

  // The packaged cover is resolved to a Blob URL on the shelf card.
  await expect(card.locator('img.bookcover')).toHaveAttribute('src', /^blob:/);

  await card.click();
  await expect(page.getByRole('heading', { name: 'Hello from an import' })).toBeVisible();

  // The packaged image is resolved to a Blob URL.
  await expect(page.locator('article.prose img')).toHaveAttribute('src', /^blob:/);

  // Back to the shelf and delete it — which asks first.
  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Delete imported book Imported Demo Book/ }).click();

  const confirm = page.getByRole('alertdialog', { name: /Delete Imported Demo Book/ });
  await expect(confirm).toBeVisible();

  // Backing out leaves the book where it was. Worth a real browser: the unit
  // tests dispatch events, and cannot see that the dialog actually blocks the
  // click that used to delete.
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('link', { name: /Imported Demo Book/ })).toHaveCount(1);

  await page.getByRole('button', { name: /Delete imported book Imported Demo Book/ }).click();
  await confirm.getByRole('button', { name: 'Delete book' }).click();
  await expect(page.getByRole('link', { name: /Imported Demo Book/ })).toHaveCount(0);
});

/**
 * A package is not always an improvement (SPEC003 E1.2). Editions make that
 * answerable, and these are the two answers a reader has to be given: an older
 * file must ask before it replaces a newer one, and an update must say what of
 * their work it can no longer show.
 */
function makeEditionFile(edition: string, quizId: string): string {
  const zip = zipSync({
    'smartbook.json': strToU8(
      JSON.stringify({
        schemaVersion: 2,
        authorId: 'example.com',
        edition,
        slug: 'edition-demo',
        title: 'Edition Demo',
        visibility: 'private',
        chapters: [{ file: '01-hello.md', order: 1 }],
      }),
    ),
    'content/01-hello.md': strToU8(
      `# Hello\n\n:::quiz{id="${quizId}"}\n\n### Pick one?\n\n- [x] Correct answer\n- [ ] Wrong answer\n\n:::\n`,
    ),
  });
  const path = join(tmpdir(), `smart-ebook-edition-${edition}-${Date.now()}.smartbook.zip`);
  // Built from `tmpdir()`, a literal edition and a timestamp; no user input
  // reaches it.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, zip);
  return path;
}

async function importFile(page: import('@playwright/test').Page, file: string) {
  await page.locator('[data-testid="import-book-input"]').setInputFiles(file);
}

/** A package that declares the chess pack but contains no chess directive. */ function makeChessPackageFile(): string {
  const manifest = {
    schemaVersion: 1,
    slug: 'chess-import',
    title: 'Chess Import Demo',
    description: 'Declares the chess pack.',
    chapters: [{ file: '01-hello.md', order: 1 }],
    islands: { packs: { chess: {} } },
  };
  const zip = zipSync({
    'smartbook.json': strToU8(JSON.stringify(manifest)),
    'content/01-hello.md': strToU8('# Openings\n\nProse only, on purpose.\n'),
  });
  const path = join(tmpdir(), `smart-ebook-chess-${Date.now()}.smartbook.zip`);
  // Built from `tmpdir()` and a timestamp; no user input reaches it.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, zip);
  return path;
}

/**
 * The reason this asserts on requests rather than on anything visible: warming
 * is invisible when it works, and the failure it prevents happens days later in
 * a tunnel. The only place the behaviour exists is the network.
 *
 * The package deliberately contains **no chess directive**. Rendering one would
 * pull the chunk anyway and prove nothing — the point is that declaring the
 * pack is enough, so the book is complete before it is opened.
 */
test('an imported book pulls down the code its islands need, before it is opened', async ({
  page,
}) => {
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  asked.length = 0; // Everything so far is the shell, which is precached anyway.

  await importFile(page, makeChessPackageFile());
  await expect(page.getByRole('link', { name: /Chess Import Demo/ })).toBeVisible();

  // The board component…
  await expect
    .poll(() => asked.some((url) => /ChessBoardIsland/.test(url)), { timeout: 10_000 })
    .toBe(true);

  // …and the engine, which is 7 MB and therefore a deliberate per-book choice
  // rather than something every reader pays for. Asserted on the request, not
  // the response: this is about it being asked for, not about waiting for it.
  expect(asked.some((url) => /stockfish-18-lite-single\.(js|wasm)/.test(url))).toBe(true);

  // Still on the shelf. Nothing was opened to make any of that happen.
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});

/**
 * Import is the better moment to warm, but it only helps books imported after
 * it shipped. A shelf filled before that would stay one tunnel away from a
 * board that cannot draw, and re-importing a dozen books is not a thing to ask
 * of anyone.
 *
 * The reload is what makes this test about *opening*: it empties the module
 * registry, so a second `import()` is a second request rather than a lookup of
 * something already loaded. Without it the assertion would pass on the warming
 * that import already did.
 */
test('opening a book warms it too, for books imported before warming existed', async ({ page }) => {
  await page.goto('/');
  await importFile(page, makeChessPackageFile());
  await expect(page.getByRole('link', { name: /Chess Import Demo/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));

  await page.getByRole('link', { name: /Chess Import Demo/ }).click();
  await expect(page.locator('article.prose')).toBeVisible();

  // The book has no chess directive, so nothing on the page could have pulled
  // this. Only opening the book did.
  await expect
    .poll(() => asked.some((url) => /ChessBoardIsland/.test(url)), { timeout: 10_000 })
    .toBe(true);
});

/**
 * SPEC002 S11. The dashboard is for books that measure the reader; a novel was
 * told `0 sections done · 0/0 quiz points · 0 quizzes taken` for ever.
 *
 * Both halves in one test on purpose — the guard is only correct if it keeps
 * the zeros a quiz book has to show.
 */
test('a book with nothing to score is not given a scoreboard', async ({ page }) => {
  const manifest = {
    schemaVersion: 1,
    slug: 'prose-only',
    title: 'Prose Only',
    chapters: [{ file: '01-hello.md', order: 1 }],
  };
  const zip = zipSync({
    'smartbook.json': strToU8(JSON.stringify(manifest)),
    'content/01-hello.md': strToU8('# One\n\nJust words.\n'),
  });
  const path = join(tmpdir(), `smart-ebook-prose-${Date.now()}.smartbook.zip`);
  // Built from `tmpdir()` and a timestamp; no user input reaches it.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, zip);

  const dashboard = page.getByRole('status', { name: 'Your progress' });

  await page.goto('/');
  await importFile(page, path);
  await page.getByRole('link', { name: /Prose Only/ }).click();
  await expect(page.locator('article.prose')).toBeVisible();
  await expect(dashboard).toHaveCount(0);

  // …and a book that does measure the reader still shows its zeros, because
  // there the zero is a position rather than an absence.
  await page.goto('/#/guide/01-getting-started');
  await expect(dashboard).toBeVisible();
  await expect(dashboard).toContainText('quiz points');
});

/**
 * SPEC010 M1, end to end: the descriptor says `fr`, and the prose says `fr`.
 *
 * Asserted on the **chapter** rather than the document, which stays `en`. The
 * shell's language is not the book's, both are on screen at once, and it is
 * the nearest `lang` that decides hyphenation and the voice a screen reader
 * reads in. Marking the document would be wrong for whichever of the two it
 * was not currently describing.
 */
test('a book written in French says so, on the prose rather than the page', async ({ page }) => {
  const manifest = {
    schemaVersion: 1,
    slug: 'roman-francais',
    title: 'Un roman',
    language: 'fr',
    chapters: [{ file: '01-chapitre.md', order: 1 }],
  };
  const zip = zipSync({
    'smartbook.json': strToU8(JSON.stringify(manifest)),
    'content/01-chapitre.md': strToU8('# Chapitre premier\n\nIl entra.\n'),
  });
  const path = join(tmpdir(), `smart-ebook-lang-${Date.now()}.smartbook.zip`);
  // Built from `tmpdir()` and a timestamp; no user input reaches it.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, zip);

  await page.goto('/');
  await importFile(page, path);
  await page.getByRole('link', { name: /Un roman/ }).click();

  await expect(page.locator('article.prose')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('an older edition asks before it replaces a newer one', async ({ page }) => {
  await page.goto('/');
  await importFile(page, makeEditionFile('1.1.0', 'q-1'));
  await expect(page.getByRole('link', { name: /Edition Demo/ })).toBeVisible();

  await importFile(page, makeEditionFile('1.0.0', 'q-1'));

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('older edition');
  // Both editions named, so the reader can tell which way round this is.
  await expect(dialog).toContainText('1.0.0');
  await expect(dialog).toContainText('1.1.0');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.shelf__import')).toContainText('kept the edition you had');
});

test('a newer edition is imported without asking', async ({ page }) => {
  await page.goto('/');
  await importFile(page, makeEditionFile('1.0.0', 'q-1'));
  await importFile(page, makeEditionFile('1.1.0', 'q-1'));

  // No prompt: the reader chose this file, and a prompt on every import is how
  // the one prompt that matters gets dismissed unread.
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('.shelf__import')).toContainText('Imported');
});

test('an update reports the answers it can no longer show, and deletes none', async ({ page }) => {
  await page.goto('/');
  await importFile(page, makeEditionFile('1.0.0', 'q-original'));

  // Answer the quiz, so there is work to lose.
  await page.getByRole('link', { name: /Edition Demo/ }).click();
  await page.locator('.quiz__option', { hasText: 'Correct answer' }).click();
  await page.getByRole('button', { name: 'Check answers' }).click();
  await expect(page.locator('.quiz__result')).toContainText('1 / 1');

  // A new edition that renamed the quiz.
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await importFile(page, makeEditionFile('1.1.0', 'q-renamed'));

  const status = page.locator('.shelf__import');
  await expect(status).toContainText('q-original');
  await expect(status).toContainText('Nothing was deleted');
});
