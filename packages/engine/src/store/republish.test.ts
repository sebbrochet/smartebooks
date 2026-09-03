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

const { saveImportedBook, listImportedBooks, makeImportedBook, deleteImportedBook } =
  await import('./importedBooks');
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

  /**
   * The delete confirmation on the shelf tells the reader their progress is
   * kept if they import the book again. That is a promise about two functions
   * that know nothing about each other — `deleteImportedBook` removes the
   * package, and reader state lives in a different store under the book's
   * slug — so it is asserted here rather than trusted.
   *
   * It also follows from the identity fix above: delete-then-reimport is the
   * same shape as republishing, and only stays true while the id is derived
   * from the declared slug.
   */
  it('keeps the reader’s progress when a deleted book is imported again', async () => {
    const stored = await saveImportedBook(edition('A book.'));
    const book = makeImportedBook(stored);
    await saveState(book.meta.slug, 'score:quiz-1', { correct: 2, total: 2 });

    await deleteImportedBook(stored.id);
    expect(await listImportedBooks()).toHaveLength(0);

    const again = makeImportedBook(await saveImportedBook(edition('A book.')));
    expect(await loadState(again.meta.slug, 'score:quiz-1', undefined)).toEqual({
      correct: 2,
      total: 2,
    });
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

/**
 * An island's persistence key used to travel in an attribute called `id`, and
 * the sanitiser applied to imported books rewrites `id` to `user-content-<id>`.
 * So every answer given in an imported book landed under a key no other copy of
 * the book would look for.
 */
describe('readers who answered before island keys stopped being clobbered', () => {
  it('keep their scores when the prefix is dropped', async () => {
    const stored = await saveImportedBook(edition('A book.'));
    await saveState(stored.id, 'score:user-content-quiz-1', { score: 3, total: 3, attempts: 1 });

    await listImportedBooks();

    expect(await loadState(stored.id, 'score:quiz-1', undefined)).toMatchObject({ score: 3 });
    expect(await loadState(stored.id, 'score:user-content-quiz-1', undefined)).toBeUndefined();
  });

  /**
   * A reader who answered the same quiz before and after the fix has both.
   * The unprefixed record is the one the running code has been writing, so it
   * is the more recent — the same rule the id migration above follows.
   */
  it('do not let a stale prefixed score overwrite a newer one', async () => {
    const stored = await saveImportedBook(edition('A book.'));
    await saveState(stored.id, 'score:user-content-quiz-1', { score: 1, total: 3, attempts: 1 });
    await saveState(stored.id, 'score:quiz-1', { score: 3, total: 3, attempts: 2 });

    await listImportedBooks();

    expect(await loadState(stored.id, 'score:quiz-1', undefined)).toMatchObject({ score: 3 });
  });

  /** An id that merely looks like a prefix is not one. Only the key's id part is cut. */
  it('leaves an ordinary key untouched', async () => {
    const stored = await saveImportedBook(edition('A book.'));
    await saveState(stored.id, 'score:quiz-user-content-1', { score: 2, total: 2, attempts: 1 });

    await listImportedBooks();

    expect(await loadState(stored.id, 'score:quiz-user-content-1', undefined)).toMatchObject({
      score: 2,
    });
  });
});
