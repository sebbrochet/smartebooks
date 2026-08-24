import { get, set, del, values, createStore } from 'idb-keyval';
import type { Book } from '../types';
import type { IslandDefinition } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import type { SmartbookDescriptor } from '../package/spec';
import type { ImportedPackage } from '../package/importBook';
import { makeBook } from '../package/makeBook';

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

/** Small deterministic hash (FNV-1a) → stable id for dedupe across re-imports. */
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function packageId(pkg: ImportedPackage): string {
  const contentKeys = Object.keys(pkg.content).sort();
  const assetKeys = Object.keys(pkg.assets).sort();
  const material =
    JSON.stringify(pkg.descriptor) +
    contentKeys.map((k) => k + pkg.content[k]).join('') +
    assetKeys.map((k) => `${k}:${pkg.assets[k].length}`).join('');
  return `imp-${hashString(material)}`;
}

export async function saveImportedBook(pkg: ImportedPackage): Promise<StoredImport> {
  const stored: StoredImport = {
    id: packageId(pkg),
    descriptor: pkg.descriptor,
    content: pkg.content,
    assets: pkg.assets,
    importedAt: Date.now(),
  };
  await set(stored.id, stored, importStore);
  return stored;
}

export async function listImportedBooks(): Promise<StoredImport[]> {
  const all = await values<StoredImport>(importStore);
  return all.filter(Boolean).sort((a, b) => a.importedAt - b.importedAt);
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
 * Imported packages ship content, not code, so they can't declare islands:
 * they get the built-in set (islands marked `disabledWhenUntrusted` still
 * render as a notice, since imported books are rendered untrusted).
 */
export function makeImportedBook(
  stored: StoredImport,
  islands: IslandDefinition[] = defaultIslands,
): Book {
  const book = makeBook(stored.descriptor, stored.content, islands);
  return { ...book, meta: { ...book.meta, slug: stored.id }, assets: stored.assets };
}
