import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom has no IndexedDB. Same per-store mock the import tests use, for the
// reason recorded there: merging the stores makes reader state answer questions
// about packages.
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

const { saveState, orphanedState, reading } = await import('./store');

beforeEach(() => banks.clear());

/**
 * SPEC003 E1.2: *carry forward every key whose id still exists; report the rest
 * rather than deleting silently.*
 *
 * Carrying forward is free — state is keyed by the book, and the book's key
 * does not change between editions — so the whole of the rule that needed
 * building is the reporting.
 */
describe('state a new edition can no longer show', () => {
  it('reports an answer whose island is gone', async () => {
    await saveState('imp-guide', 'score:ch1-basics', { score: 3, total: 3 });
    await saveState('imp-guide', 'score:ch2-renamed', { score: 1, total: 2 });

    const orphans = await orphanedState('imp-guide', new Set(['ch1-basics']));

    expect(orphans).toEqual([{ key: 'score:ch2-renamed', id: 'ch2-renamed' }]);
  });

  it('says nothing when every id is still there', async () => {
    await saveState('imp-guide', 'score:ch1-basics', { score: 3, total: 3 });
    await saveState('imp-guide', 'progress:ch1-done', { complete: true });

    expect(await orphanedState('imp-guide', new Set(['ch1-basics', 'ch1-done']))).toEqual([]);
  });

  /** Reporting must not destroy the thing it is reporting. */
  it('deletes nothing', async () => {
    await saveState('imp-guide', 'score:gone', { score: 1, total: 1 });

    await orphanedState('imp-guide', new Set());

    expect(bank().has('smart-ebooks:imp-guide:score:gone')).toBe(true);
  });

  /**
   * `reading:position` is the engine's, not an author's. Without this it would
   * be reported as orphaned by every edition of every book.
   */
  it('ignores the engine’s own keys', async () => {
    await reading.set('imp-guide', { chapterSlug: '01-intro' });

    expect(await orphanedState('imp-guide', new Set())).toEqual([]);
  });

  it('ignores other books entirely', async () => {
    await saveState('imp-other', 'score:elsewhere', { score: 1, total: 1 });

    expect(await orphanedState('imp-guide', new Set())).toEqual([]);
  });

  /** An id may contain a colon; only the first one separates the kind. */
  it('reads the id as everything after the kind', async () => {
    await saveState('imp-guide', 'score:ch1:part-2', { score: 1, total: 1 });

    expect(await orphanedState('imp-guide', new Set(['ch1:part-2']))).toEqual([]);
    expect(await orphanedState('imp-guide', new Set(['ch1']))).toEqual([
      { key: 'score:ch1:part-2', id: 'ch1:part-2' },
    ]);
  });
});
