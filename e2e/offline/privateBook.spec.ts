import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The route the README documents for a book kept in another repository:
 * package it, build the app, serve it, import the package.
 *
 * Each half is tested elsewhere — packaging an external private book, and
 * importing a `.smartbook` — and nothing proved they compose, or that they
 * compose against a **built** site rather than a dev server. That is the whole
 * point here: it is the only way an author can see what a reader will get.
 *
 * The book is private and spans two files on purpose. That is the case the
 * route exists for, and the one where a chapter-less link and a book-wide
 * section index have to survive being packaged and re-read as an untrusted
 * import.
 *
 * The real packager is invoked rather than a zip built in the test, because
 * the packager is half of what is being claimed.
 */
function packagePrivateBook(): string {
  const root = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-private-'));
  const folder = join(workspace, 'books', 'cellar-private');

  // Both paths are this repo's own, joined onto a fresh `mkdtempSync` directory.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(join(folder, 'content'), { recursive: true });
  cpSync(join(root, 'books', 'gamebook', 'content'), join(folder, 'content'), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(
    join(folder, 'smartbook.json'),
    JSON.stringify({
      schemaVersion: 2,
      authorId: 'example.com',
      slug: 'cellar-private',
      title: 'The Cellar Door (private)',
      language: 'en',
      visibility: 'private',
      edition: '2026-09-14',
      unitDepth: 2,
      islands: { packs: { gamebook: {} } },
    }),
  );

  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts', 'package-book.mjs'), 'cellar-private'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SMART_EBOOKS_BOOKS_DIR: join(workspace, 'books'),
        SMART_EBOOKS_DIST_DIR: join(workspace, 'dist'),
      },
    },
  );

  if (result.status !== 0) throw new Error(`packaging failed: ${result.stderr}${result.stdout}`);
  return join(workspace, 'dist', 'cellar-private.smartbook');
}

test('a private, multi-file gamebook imports into the built site and plays', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-testid="import-book-input"]').setInputFiles(packagePrivateBook());

  const card = page.getByRole('link', { name: /The Cellar Door \(private\)/ });
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.locator('article.prose')).toContainText('The cellar door stands open');

  // 1 → 3 → 5 → 8 are in the first file; 11 is in the second. The reader is
  // never told, and the link the package produced names no chapter.
  await page.getByRole('link', { name: 'turn to 3' }).click();
  await page.getByRole('link', { name: 'turn to 5' }).click();
  await page.getByRole('link', { name: 'turn to 8' }).click();

  const crossing = page.getByRole('link', { name: 'turn to 11' });
  await expect(crossing).toHaveAttribute('href', /\?s=11$/);
  await crossing.click();

  await expect(page.locator('article.prose')).toContainText('You took your time');
  await expect(page.locator('.toc a')).toHaveCount(5);
});
