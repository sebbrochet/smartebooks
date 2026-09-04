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

const {
  saveImportedBook,
  listImportedBooks,
  makeImportedBook,
  deleteImportedBook,
  importBook,
  previewImport,
} = await import('./importedBooks');
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

/**
 * `authorId` scopes a book's identity, so two authors may both publish
 * `study-guide` and remain two books (SPEC003 E1.2). The interesting cases are
 * not the happy one — they are the two ways this could quietly destroy work.
 */
describe('books scoped by their author', () => {
  function byAuthor(authorId: string, slug = 'study-guide'): ImportedPackage {
    const pkg = edition('A book.');
    pkg.descriptor = { ...pkg.descriptor, authorId, slug };
    return pkg;
  }

  it('keeps two authors sharing a slug apart', async () => {
    await saveImportedBook(byAuthor('alice.example'));
    await saveImportedBook(byAuthor('bob.example'));

    const shelved = await listImportedBooks();
    expect(shelved).toHaveLength(2);
    expect(new Set(shelved.map((book) => book.id)).size).toBe(2);
  });

  it('keeps their progress apart too', async () => {
    const alice = makeImportedBook(await saveImportedBook(byAuthor('alice.example')));
    await saveState(alice.meta.slug, 'score:q-1', { score: 3, total: 3, attempts: 1 });

    const bob = makeImportedBook(await saveImportedBook(byAuthor('bob.example')));

    expect(await loadState(bob.meta.slug, 'score:q-1', undefined)).toBeUndefined();
    expect(await loadState(alice.meta.slug, 'score:q-1', undefined)).toMatchObject({ score: 3 });
  });

  /**
   * The migration that matters: every book already on a shelf was published
   * before `authorId` existed, and acquires one exactly once. That edition must
   * be the same book to its reader, not a second copy beside the first.
   */
  it('adopts the reader’s copy when a book gains an author id', async () => {
    const before = makeImportedBook(await saveImportedBook(edition('First edition.')));
    await saveState(before.meta.slug, 'score:q-1', { score: 2, total: 3, attempts: 1 });

    const after = makeImportedBook(await saveImportedBook(byAuthor('alice.example')));

    expect(await listImportedBooks()).toHaveLength(1);
    expect(after.meta.slug).not.toBe(before.meta.slug);
    expect(await loadState(after.meta.slug, 'score:q-1', undefined)).toMatchObject({ score: 2 });
    expect(await loadState(before.meta.slug, 'score:q-1', undefined)).toBeUndefined();
  });

  /**
   * ...but adoption must not overwrite. A reader who already has the authored
   * edition and *also* an old unscoped copy of something with the same slug
   * keeps the newer work, not whatever the predecessor left behind.
   */
  it('never lets an unscoped predecessor overwrite a book already imported', async () => {
    const authored = makeImportedBook(await saveImportedBook(byAuthor('alice.example')));
    await saveState(authored.meta.slug, 'score:q-1', { score: 3, total: 3, attempts: 1 });

    // An older, unscoped copy is still on the shelf with its own progress.
    const legacy = makeImportedBook(await saveImportedBook(edition('Older, unscoped.')));
    await saveState(legacy.meta.slug, 'score:q-1', { score: 1, total: 3, attempts: 1 });

    // Re-importing the authored edition must not adopt over the top of itself.
    await saveImportedBook(byAuthor('alice.example'));

    expect(await loadState(authored.meta.slug, 'score:q-1', undefined)).toMatchObject({ score: 3 });
  });

  /** The id is a route segment and a store key prefix, so it can contain neither. */
  it('produces an id safe for a hash route and a store key', async () => {
    const stored = await saveImportedBook(byAuthor('alice.example'));
    expect(stored.id).not.toContain('/');
    expect(stored.id).not.toContain(':');
    expect(stored.id.startsWith('imp-')).toBe(true);
  });
});

/**
 * `edition` earns its place only if it can answer "is this newer than what I
 * have?" — otherwise every import is a silent replace, which is fine when the
 * file is newer and quietly destructive when it is not (SPEC003 E1.2).
 */
describe('what an import does to a shelf', () => {
  // The parameter is `version`, not `edition`, because the fixture that builds
  // a package is itself called `edition` — named before the descriptor had a
  // field of that name.
  function published(version: string | undefined, prose = 'A book.'): ImportedPackage {
    const pkg = edition(prose);
    pkg.descriptor = { ...pkg.descriptor, authorId: 'alice.example', edition: version };
    return pkg;
  }

  it('reports a book this reader has never had as new', async () => {
    const { outcome } = await importBook(published('1.0.0'));
    expect(outcome).toBe('new');
  });

  it('recognises a newer edition as an update', async () => {
    await importBook(published('1.0.0'));
    const { outcome, replaced } = await importBook(published('1.1.0'));

    expect(outcome).toBe('update');
    expect(replaced).toBe('1.0.0');
  });

  it('recognises the same edition as a duplicate', async () => {
    await importBook(published('2026-09-04'));
    expect((await importBook(published('2026-09-04'))).outcome).toBe('duplicate');
  });

  /** The case the whole field exists to catch. */
  it('recognises an older edition as a downgrade', async () => {
    await importBook(published('1.1.0'));
    expect((await importBook(published('1.0.0'))).outcome).toBe('downgrade');
  });

  it('says it does not know when the editions cannot be ordered', async () => {
    await importBook(published('2026-09-04'));
    expect((await importBook(published('1.0.0'))).outcome).toBe('unknown');

    await importBook(published(undefined));
    expect((await importBook(published(undefined))).outcome).toBe('unknown');
  });

  /** Asking is not doing: a preview must leave the shelf exactly as it was. */
  it('previews without importing', async () => {
    await importBook(published('1.1.0'));

    const preview = await previewImport(published('1.0.0'));
    expect(preview.outcome).toBe('downgrade');

    const shelved = await listImportedBooks();
    expect(shelved).toHaveLength(1);
    expect(shelved[0].descriptor.edition).toBe('1.1.0');
  });
});
