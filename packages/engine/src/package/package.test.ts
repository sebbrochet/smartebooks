import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { makeBook } from './makeBook';
import { exportBookToZip } from './exportBook';
import { parseSmartbook } from './importBook';
import type { SmartbookDescriptor } from './spec';

const descriptor: SmartbookDescriptor = {
  schemaVersion: 1,
  slug: 'demo',
  title: 'Demo Book',
  description: 'A test book.',
  chapters: [
    { file: '02-second.md', order: 2 },
    { file: '01-first.md', order: 1 },
  ],
};

const modules: Record<string, string> = {
  './content/01-first.md': '# First\n\nHello one.',
  './content/02-second.md': '# Second\n\nHello two.',
};

describe('makeBook', () => {
  it('builds a book from a descriptor + content, ordered by the descriptor', () => {
    const book = makeBook(descriptor, modules, []);
    expect(book.meta).toEqual({ slug: 'demo', title: 'Demo Book', description: 'A test book.' });
    expect(book.chapters.map((c) => c.slug)).toEqual(['01-first', '02-second']);
    expect(book.chapters[0].title).toBe('First');
    expect(book.descriptor).toBe(descriptor);
  });

  it('falls back to filename ordering when the descriptor lists no chapters', () => {
    const book = makeBook({ ...descriptor, chapters: undefined }, modules, []);
    expect(book.chapters.map((c) => c.slug)).toEqual(['01-first', '02-second']);
  });
});

describe('exportBookToZip', () => {
  it('packages smartbook.json + content and round-trips', () => {
    const book = makeBook(descriptor, modules, []);
    const zip = exportBookToZip(book);
    const files = unzipSync(zip);

    expect(Object.keys(files)).toContain('smartbook.json');
    expect(Object.keys(files)).toContain('content/01-first.md');
    expect(Object.keys(files)).toContain('content/02-second.md');

    const manifest = JSON.parse(strFromU8(files['smartbook.json'])) as SmartbookDescriptor;
    expect(manifest.slug).toBe('demo');
    expect(manifest.schemaVersion).toBe(1);

    expect(strFromU8(files['content/01-first.md'])).toContain('Hello one.');
  });

  // Without declared chapters, order and titles survive only when filename
  // prefixes happen to encode them (SPEC003 D7).
  it('writes the resolved chapters into the manifest', () => {
    const book = makeBook(descriptor, modules, []);
    const files = unzipSync(exportBookToZip(book));
    const manifest = JSON.parse(strFromU8(files['smartbook.json'])) as SmartbookDescriptor;

    expect(manifest.chapters).toEqual([
      { file: '01-first.md', order: 1, title: 'First' },
      { file: '02-second.md', order: 2, title: 'Second' },
    ]);
  });

  it('survives a round-trip when nothing but the descriptor carries the order', () => {
    // Filenames deliberately give no ordering hint, and the descriptor declares
    // none either, so before this change the exported package relied on zip
    // entry order being preserved. Now the order is stated explicitly.
    const undeclared: SmartbookDescriptor = {
      schemaVersion: 1,
      slug: 'demo',
      title: 'Demo Book',
    };
    const sources = {
      './content/apple.md': '# Apple\n\nOne.',
      './content/zebra.md': '# Zebra\n\nTwo.',
    };

    const original = makeBook(undeclared, sources, []);
    const files = unzipSync(exportBookToZip(original));
    const manifest = JSON.parse(strFromU8(files['smartbook.json'])) as SmartbookDescriptor;

    // The package now describes itself, instead of leaving the reader to
    // re-derive structure from filenames.
    expect(manifest.chapters).toBeDefined();
    expect(manifest.chapters?.map((c) => c.file)).toEqual(
      original.chapters.map((c) => `${c.slug}.md`),
    );

    const reimported = parseSmartbook(exportBookToZip(original));
    const rebuilt = makeBook(reimported.descriptor, reimported.content, []);
    expect(rebuilt.chapters.map((c) => c.slug)).toEqual(original.chapters.map((c) => c.slug));
    expect(rebuilt.chapters.map((c) => c.title)).toEqual(original.chapters.map((c) => c.title));
  });

  it('includes packaged assets in the zip', () => {
    const book = makeBook(descriptor, modules, []);
    book.assets = { 'assets/pixel.png': new Uint8Array([9, 8, 7]) };
    const files = unzipSync(exportBookToZip(book));
    expect(Object.keys(files)).toContain('assets/pixel.png');
    expect(files['assets/pixel.png']).toEqual(new Uint8Array([9, 8, 7]));
  });
});
