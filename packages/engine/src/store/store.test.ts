import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importProgress } from './store';

// jsdom has no IndexedDB, so back idb-keyval with an in-memory map. This also
// lets the tests assert exactly which keys were written.
const { memStore } = vi.hoisted(() => ({ memStore: new Map<string, unknown>() }));

vi.mock('idb-keyval', () => ({
  get: async (key: string) => memStore.get(key),
  set: async (key: string, value: unknown) => {
    memStore.set(key, value);
  },
  del: async (key: string) => {
    memStore.delete(key);
  },
  entries: async () => [...memStore.entries()],
  createStore: () => undefined,
}));

beforeEach(() => memStore.clear());

describe('importProgress (validation)', () => {
  it('rejects a non-backup object', async () => {
    await expect(importProgress({ foo: 'bar' })).rejects.toThrow(
      /valid Smart Ebooks progress backup/i,
    );
  });

  it('rejects null / wrong format', async () => {
    await expect(importProgress(null)).rejects.toThrow();
    await expect(importProgress({ format: 'something-else', books: {} })).rejects.toThrow();
  });

  it('accepts a valid backup with no entries (no store writes)', async () => {
    const result = await importProgress({
      format: 'smart-ebooks-progress',
      schemaVersion: 1,
      books: {},
    });
    expect(result).toEqual({ booksImported: 0, entriesImported: 0 });
  });
});

describe('importProgress (key filtering)', () => {
  function backup(entries: Record<string, unknown>) {
    return { format: 'smart-ebooks-progress', schemaVersion: 1, books: { demo: entries } };
  }

  it('restores state from islands that ship outside the engine', async () => {
    // Regression: an allow-list of engine-known prefixes silently dropped the
    // chess pack's state, so exporting and restoring lost every solved puzzle.
    const result = await importProgress(
      backup({ 'chesspuzzle:ch1': { solved: true }, 'chessply:ch1': 4 }),
    );

    expect(result.entriesImported).toBe(2);
    expect(memStore.get('smart-ebooks:demo:chesspuzzle:ch1')).toEqual({ solved: true });
    expect(memStore.get('smart-ebooks:demo:chessply:ch1')).toBe(4);
  });

  it('still restores the engine-provided kinds', async () => {
    const result = await importProgress(
      backup({
        'progress:a': { complete: true },
        'score:b': { score: 1, total: 1 },
        'review:c': { reps: 2 },
        'media:d': true,
        'game:e': { best: 3 },
        'reading:position': { chapterSlug: '01' },
      }),
    );
    expect(result.entriesImported).toBe(6);
  });

  it('rejects keys that are not <kind>:<id>', async () => {
    const result = await importProgress(
      backup({ nokind: 1, '': 1, 'Upper:x': 1, 'has space:x': 1, 'progress:': 1 }),
    );
    expect(result.entriesImported).toBe(0);
    expect(memStore.size).toBe(0);
  });
});
