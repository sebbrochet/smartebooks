import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseSmartbook } from './importBook';
import { MIN_SUPPORTED_SCHEMA, SMARTBOOK_SCHEMA_VERSION } from './spec';
import { makeImportedBook } from '../store/importedBooks';
import type { StoredImport } from '../store/importedBooks';

function zip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, text] of Object.entries(files)) entries[name] = strToU8(text);
  return zipSync(entries);
}

const validManifest = JSON.stringify({
  schemaVersion: 1,
  slug: 'imported-demo',
  title: 'Imported Demo',
  chapters: [{ file: '01-hello.md', order: 1 }],
});

describe('parseSmartbook', () => {
  it('parses a valid package', () => {
    const pkg = parseSmartbook(
      zip({ 'smartbook.json': validManifest, 'content/01-hello.md': '# Hello\n\nHi.' }),
    );
    expect(pkg.descriptor.slug).toBe('imported-demo');
    expect(pkg.content['content/01-hello.md']).toContain('Hello');
  });

  it('rejects a package with no smartbook.json', () => {
    expect(() => parseSmartbook(zip({ 'content/01-hello.md': '# Hi' }))).toThrow(
      /missing smartbook/i,
    );
  });

  it('rejects an unsupported schema version', () => {
    const bad = JSON.stringify({ schemaVersion: 99, slug: 'x', title: 'X' });
    expect(() => parseSmartbook(zip({ 'smartbook.json': bad, 'content/01.md': '# a' }))).toThrow(
      /version/i,
    );
  });

  // A range, not an equality: exact-match versioning would make every schema
  // bump a flag day for readers and packages alike (SPEC003 D6 / E1.3).
  it('accepts a package written against an older schema', () => {
    const older = JSON.stringify({
      schemaVersion: MIN_SUPPORTED_SCHEMA,
      slug: 'older',
      title: 'Older',
    });
    const pkg = parseSmartbook(zip({ 'smartbook.json': older, 'content/01.md': '# a' }));
    expect(pkg.descriptor.slug).toBe('older');
  });

  it('accepts a newer package that declares it can be read by this reader', () => {
    const newer = JSON.stringify({
      schemaVersion: SMARTBOOK_SCHEMA_VERSION + 5,
      minReaderSchema: SMARTBOOK_SCHEMA_VERSION,
      slug: 'newer',
      title: 'Newer',
    });
    const pkg = parseSmartbook(zip({ 'smartbook.json': newer, 'content/01.md': '# a' }));
    expect(pkg.descriptor.slug).toBe('newer');
  });

  it('rejects a newer package that needs a newer reader', () => {
    const newer = JSON.stringify({
      schemaVersion: SMARTBOOK_SCHEMA_VERSION + 5,
      minReaderSchema: SMARTBOOK_SCHEMA_VERSION + 1,
      slug: 'newer',
      title: 'Newer',
    });
    expect(() => parseSmartbook(zip({ 'smartbook.json': newer, 'content/01.md': '# a' }))).toThrow(
      /newer reader/i,
    );
  });

  it('rejects a non-integer schema version', () => {
    const bad = JSON.stringify({ schemaVersion: 'one', slug: 'x', title: 'X' });
    expect(() => parseSmartbook(zip({ 'smartbook.json': bad, 'content/01.md': '# a' }))).toThrow(
      /invalid schemaVersion/i,
    );
  });

  it('rejects an unsafe slug', () => {
    const bad = JSON.stringify({ schemaVersion: 1, slug: '../evil', title: 'X' });
    expect(() => parseSmartbook(zip({ 'smartbook.json': bad, 'content/01.md': '# a' }))).toThrow(
      /slug/i,
    );
  });

  it('rejects unsafe file paths', () => {
    expect(() =>
      parseSmartbook(zip({ 'smartbook.json': validManifest, '../evil.md': 'x' })),
    ).toThrow(/unsafe path/i);
  });

  it('rejects a package with no chapters', () => {
    expect(() => parseSmartbook(zip({ 'smartbook.json': validManifest }))).toThrow(/no chapters/i);
  });

  it('extracts packaged assets', () => {
    const entries: Record<string, Uint8Array> = {
      'smartbook.json': strToU8(validManifest),
      'content/01-hello.md': strToU8('# Hi\n\n![p](assets/pixel.png)'),
      'assets/pixel.png': new Uint8Array([1, 2, 3, 4]),
    };
    const pkg = parseSmartbook(zipSync(entries));
    expect(pkg.assets['assets/pixel.png']).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});

describe('makeImportedBook', () => {
  it('keys the book by its import id (never the declared slug)', () => {
    const stored: StoredImport = {
      id: 'imp-abcd1234',
      descriptor: {
        schemaVersion: 1,
        slug: 'guide', // same as a bundled book — must not collide
        title: 'Imported Guide',
        chapters: [{ file: '01-hello.md', order: 1 }],
      },
      content: { 'content/01-hello.md': '# Hello\n\nHi.' },
      assets: { 'assets/pixel.png': new Uint8Array([1, 2, 3]) },
      importedAt: Date.now(),
    };
    const book = makeImportedBook(stored);
    expect(book.meta.slug).toBe('imp-abcd1234');
    expect(book.meta.title).toBe('Imported Guide');
    expect(book.descriptor?.slug).toBe('guide'); // original preserved for re-export
    expect(book.assets?.['assets/pixel.png']).toEqual(new Uint8Array([1, 2, 3]));
  });
});
