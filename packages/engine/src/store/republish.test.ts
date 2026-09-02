import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImportedPackage } from '../package/importBook';

// jsdom has no IndexedDB, so back idb-keyval with in-memory maps. Note the
// maps are **per store**: imported packages and reader state live in different
// IndexedDB stores, and a mock that merges them makes `values()` return reader
// progress where the code expects packages.
const { banks } = vi.hoisted(() => ({ banks: new Map<string, Map<string, unknown>>() }));

function bank(store?: string): Map<string, unknown> {
  const name = store ?? 'default';
  if (!banks.has(name)) banks.set(name, new Map());
  return banks.get(name) as Map<string, unknown>;
}

vi.mock('idb-keyval', () => ({
  createStore: (db: string, name: string) => `${db}/${name}`,
  get: async (key: string, store?: string) => bank(store).get(key),
  set: async (key: string, value: unknown, store?: string) => {
    bank(store).set(key, value);
  },
  del: async (key: string, store?: string) => {
    bank(store).delete(key);
  },
  values: async (store?: string) => [...bank(store).values()],
  entries: async (store?: string) => [...bank(store).entries()],
}));

const { saveImportedBook, listImportedBooks, makeImportedBook } = await import('./importedBooks');
const { saveState, loadState } = await import('./store');

/** The store imported packages live in, for tests that plant legacy records. */
const imports = () => bank('smart-ebooks-imports/books');

/** Plants a record as the pre-correction scheme would have written it. */
function memStoreLegacy(id: string, record: unknown): void {
  imports().set(id, record);
}

beforeEach(() => banks.clear());

/** A one-chapter package, so an "edition" is a single string away. */
function edition(prose: string): ImportedPackage {
  return {
    descriptor: {
      schemaVersion: 2,
      slug: 'study-guide',
      title: 'A Study Guide',
      visibility: 'public',
      chapters: [{ file: '01-intro.md', order: 1 }],
    },
    content: { '01-intro.md': `# Intro\n\n${prose}\n` },
    assets: {},
  } as ImportedPackage;
}

describe('a book that gets republished', () => {
  /**
   * The case this platform exists for: an author corrects a typo and ships a
   * new edition of a book people are part-way through.
   *
   * Reader state is keyed by `book.meta.slug`, and an imported book's slug is
   * its stored id — so if that id is derived from the *content*, then changing
   * one character renames the book as far as every quiz score, checkpoint and
   * reading position is concerned.
   */
  it('keeps the reader’s progress across a corrected edition', async () => {
    const first = await saveImportedBook(edition('Teh quick brown fox.'));
    const book = makeImportedBook(first);

    await saveState(book.meta.slug, 'score:quiz-1', { correct: 3, total: 3 });

    // The author fixes the typo and republishes; the reader imports it.
    const second = await saveImportedBook(edition('The quick brown fox.'));
    const updated = makeImportedBook(second);

    expect(await loadState(updated.meta.slug, 'score:quiz-1', undefined)).toEqual({
      correct: 3,
      total: 3,
    });
  });

  /**
   * …and it is the same book on the shelf, not a second copy sitting next to
   * the first with the same title and none of the progress.
   */
  it('replaces the edition rather than shelving a second copy', async () => {
    await saveImportedBook(edition('First edition.'));
    await saveImportedBook(edition('Second edition.'));

    const shelved = await listImportedBooks();
    expect(shelved).toHaveLength(1);
    expect(shelved[0].content['01-intro.md']).toContain('Second edition');
  });

  /**
   * Identity is the declared slug, so two genuinely different books remain
   * different — the property the content hash was providing.
   */
  it('keeps two different books apart', async () => {
    await saveImportedBook(edition('A book.'));

    const other = edition('Another book.');
    other.descriptor = { ...other.descriptor, slug: 'other-guide', title: 'Another Guide' };
    await saveImportedBook(other);

    expect(await listImportedBooks()).toHaveLength(2);
  });

  /** Imported ids stay namespaced, so they can never collide with a bundled book. */
  it('never takes a bundled book’s slug', async () => {
    const stored = await saveImportedBook(edition('A book.'));
    expect(stored.id).not.toBe('study-guide');
    expect(stored.id.startsWith('imp-')).toBe(true);
  });
});

describe('readers who imported under the old scheme', () => {
  /**
   * Books already on a shelf are keyed by a hash of their contents. Correcting
   * that scheme must not itself throw away the progress it exists to protect,
   * so a stored record is re-keyed on read and its state travels with it.
   */
  it('keep their progress when the record is re-keyed', async () => {
    const legacyId = 'imp-6e66c4e8';
    const pkg = edition('First edition.');

    memStoreLegacy(legacyId, {
      id: legacyId,
      descriptor: pkg.descriptor,
      content: pkg.content,
      assets: pkg.assets,
      importedAt: 1,
    });
    await saveState(legacyId, 'score:quiz-1', { correct: 2, total: 2 });

    const [shelved] = await listImportedBooks();

    expect(shelved.id).toBe('imp-study-guide');
    expect(await loadState(shelved.id, 'score:quiz-1', undefined)).toEqual({
      correct: 2,
      total: 2,
    });

    // The old record and its keys are gone rather than left as a second copy.
    expect(imports().has(legacyId)).toBe(false);
    expect(await loadState(legacyId, 'score:quiz-1', undefined)).toBeUndefined();
  });

  /**
   * The duplicate shelf entries the old scheme produced collapse into one.
   * Oldest migrates first, so the edition the reader was on most recently is
   * the one whose progress survives.
   */
  it('collapse the duplicate copies the old scheme shelved', async () => {
    const pkg = edition('Second edition.');

    for (const [id, at] of [
      ['imp-aaaaaaaa', 1],
      ['imp-bbbbbbbb', 2],
    ] as const) {
      memStoreLegacy(id, { ...pkg, id, importedAt: at });
      await saveState(id, 'reading:position', { chapterSlug: id, at });
    }

    const shelved = await listImportedBooks();
    expect(shelved).toHaveLength(1);
    expect(shelved[0].id).toBe('imp-study-guide');

    const position = await loadState<{ chapterSlug: string } | undefined>(
      'imp-study-guide',
      'reading:position',
      undefined,
    );
    expect(position?.chapterSlug).toBe('imp-bbbbbbbb');
  });

  it('leave an already-migrated shelf alone', async () => {
    await saveImportedBook(edition('A book.'));
    const before = await listImportedBooks();
    const after = await listImportedBooks();
    expect(after).toEqual(before);
  });
});
