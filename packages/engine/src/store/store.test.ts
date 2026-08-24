import { describe, it, expect } from 'vitest';
import { importProgress } from './store';

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
