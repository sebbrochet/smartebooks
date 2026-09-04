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
  await page.getByRole('link', { name: 'Smart Ebooks' }).click();
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
  await page.getByRole('link', { name: 'Smart Ebooks', exact: true }).click();
  await importFile(page, makeEditionFile('1.1.0', 'q-renamed'));

  const status = page.locator('.shelf__import');
  await expect(status).toContainText('q-original');
  await expect(status).toContainText('Nothing was deleted');
});
