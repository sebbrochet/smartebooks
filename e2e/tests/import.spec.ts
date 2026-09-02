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
