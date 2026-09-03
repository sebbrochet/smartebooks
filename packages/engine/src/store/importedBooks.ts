import { get, set, del, values, createStore } from 'idb-keyval';
import type { Book } from '../types';
import type { IslandDefinition } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import type { SmartbookDescriptor } from '../package/spec';
import type { ImportedPackage } from '../package/importBook';
import { makeBook } from '../package/makeBook';
import { renameBookState, migrateClobberedKeys } from './store';

// A dedicated IndexedDB store so imported book packages never mix with the
// per-book reader-progress keys.
const importStore = createStore('smart-ebooks-imports', 'books');

export interface StoredImport {
  id: string;
  descriptor: SmartbookDescriptor;
  content: Record<string, string>;
  assets: Record<string, Uint8Array>;
  importedAt: number;
}

/**
 * What makes an imported book *that book*, across every edition of it.
 *
 * **The declared slug, not a hash of the contents.** The id becomes the book's
 * `meta.slug`, which is the key every quiz score, checkpoint and reading
 * position is stored under — so identifying a book by its bytes meant that
 * correcting one typo renamed it, orphaning the reader's progress and shelving
 * a second copy beside the first with the same title and none of their work.
 * Republishing is the normal life of a book, not an edge case.
 *
 * The slug is the identity the format already uses — it is how bundled books
 * are addressed — and it is validated on import (`[a-z0-9][a-z0-9-]*`, ≤64
 * characters), so it is safe and legible as a key.
 *
 * Still prefixed, so an imported book can never take a bundled book's slug.
 *
 * The cost, accepted deliberately: two unrelated books that both declare
 * `study-guide` are one book to this reader, and importing the second replaces
 * the first. That is the same trade the format already makes for bundled
 * books, and replacing is exactly what a new edition should do.
 */
function identityFor(descriptor: SmartbookDescriptor): string {
  return `imp-${descriptor.slug}`;
}

export async function saveImportedBook(pkg: ImportedPackage): Promise<StoredImport> {
  const stored: StoredImport = {
    id: identityFor(pkg.descriptor),
    descriptor: pkg.descriptor,
    content: pkg.content,
    assets: pkg.assets,
    importedAt: Date.now(),
  };
  await set(stored.id, stored, importStore);
  return stored;
}

export async function listImportedBooks(): Promise<StoredImport[]> {
  // Only imported books were ever sanitised, so this is the path where a
  // clobbered key can exist. Cheap once nothing matches.
  await migrateClobberedKeys();

  const all = await values<StoredImport>(importStore);
  const shelved = all.filter(Boolean).sort((a, b) => a.importedAt - b.importedAt);

  // Oldest first, so where the old scheme had shelved two copies of one book
  // the newest edition's progress is the one that survives — it is the copy
  // the reader was last reading.
  const migrated: StoredImport[] = [];
  for (const stored of shelved) migrated.push(await migrate(stored));

  return [...new Map(migrated.map((stored) => [stored.id, stored])).values()];
}

/**
 * Re-key a record stored under the old content-hash id, carrying the reader's
 * progress with it.
 *
 * Done on read rather than as a one-shot upgrade step: there is no other moment
 * every path passes through, and once the ids agree this costs a comparison.
 */
async function migrate(stored: StoredImport): Promise<StoredImport> {
  const id = identityFor(stored.descriptor);
  if (id === stored.id) return stored;

  const moved: StoredImport = { ...stored, id };
  await set(id, moved, importStore);
  await del(stored.id, importStore);
  await renameBookState(stored.id, id);
  return moved;
}

export async function getImportedBook(id: string): Promise<StoredImport | undefined> {
  return get<StoredImport>(id, importStore);
}

export async function deleteImportedBook(id: string): Promise<void> {
  await del(id, importStore);
}

/**
 * Build a renderable `Book` from a stored import. The book is keyed by its
 * internal import id (not its declared slug) so it can never collide with a
 * bundled book, while the original descriptor is preserved for re-export.
 *
 * Imported packages ship content, not code, so they cannot *supply* islands —
 * but they may **declare** the packs they need, and a host that has those packs
 * should pass them in. The default is the built-in set only; the platform
 * resolves declared packs via `resolveImportedIslands` (islands marked
 * `disabledWhenUntrusted` still render as a notice, since imported books are
 * rendered untrusted).
 */
export function makeImportedBook(
  stored: StoredImport,
  islands: IslandDefinition[] = defaultIslands,
): Book {
  const book = makeBook(stored.descriptor, stored.content, islands);
  return { ...book, meta: { ...book.meta, slug: stored.id }, assets: stored.assets };
}
