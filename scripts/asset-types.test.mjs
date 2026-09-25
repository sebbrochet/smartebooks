/**
 * Run with `npm run test:scripts`.
 *
 * Every kind of asset a book ships must be one the build actually bundles.
 *
 * `apps/library/src/books.ts` collects assets with two `import.meta.glob`
 * patterns, each carrying a hardcoded list of extensions — one read as text,
 * one as data URLs. Nothing else knows about those lists, and *nothing else
 * checks them*: `lint:content` verifies that a declared asset exists in the
 * repository, which it does, so a book using a type missing from the globs
 * passes every check and then renders "this part of the book could not be
 * shown" to a reader.
 *
 * This test exists because `.abc` did exactly that on 2026-09-25 — the file was
 * committed, declared, and linted clean, and the score never appeared.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { BOOKS_DIR, ROOT, listBookFolders } from './book-sources.mjs';

/** The extensions each glob in `books.ts` will pick up. */
function bundledExtensions() {
  const source = readFileSync(join(ROOT, 'apps/library/src/books.ts'), 'utf8');
  const globs = [...source.matchAll(/assets\/\*\.\{([^}]+)\}/g)];
  assert.ok(globs.length >= 2, 'expected the text and binary asset globs in books.ts');
  return new Set(globs.flatMap((match) => match[1].split(',').map((ext) => ext.trim())));
}

/** Every extension actually present in a book's `assets/` folder. */
function shippedExtensions() {
  const seen = new Map();
  for (const folder of listBookFolders()) {
    const assets = join(BOOKS_DIR, folder, 'assets');
    if (!existsSync(assets)) continue;
    for (const file of readdirSync(assets)) {
      const ext = extname(file).slice(1).toLowerCase();
      if (!ext) continue;
      if (!seen.has(ext)) seen.set(ext, `${folder}/assets/${file}`);
    }
  }
  return seen;
}

describe('asset types the build can carry', () => {
  test('every asset a book ships is one the build bundles', () => {
    const bundled = bundledExtensions();
    const missing = [...shippedExtensions()]
      .filter(([ext]) => !bundled.has(ext))
      .map(([ext, example]) => `.${ext} (${example})`);

    assert.deepEqual(
      missing,
      [],
      `These assets are committed and declared but would not reach a reader.\n` +
        `Add the extension to a glob in apps/library/src/books.ts — text assets\n` +
        `are read with ?raw, binaries with ?inline.\n  ${missing.join('\n  ')}`,
    );
  });
});
