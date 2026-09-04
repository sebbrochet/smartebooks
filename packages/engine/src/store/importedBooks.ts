import { get, set, del, values, createStore } from 'idb-keyval';
import type { Book } from '../types';
import type { IslandDefinition } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import type { SmartbookDescriptor } from '../package/spec';
import type { ImportedPackage } from '../package/importBook';
import { makeBook } from '../package/makeBook';
import { compareEditions } from '../package/edition';
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
 *
 * **Scoped by `authorId` when the package declares one** (SPEC003 E1.2), which
 * removes that cost for every book published from here on: two authors may both
 * call a book `study-guide` and remain two books. A package without one keeps
 * the unscoped key it has always had, because packages written before the field
 * existed are already on shelves and re-keying them for the sake of tidiness
 * would orphan exactly the progress this scheme exists to protect.
 *
 * The separator is `~`, and neither `/` nor `:` would do. This id becomes the
 * book's `meta.slug`, which is both a hash-route segment and part of every
 * store key: `#/imp-example.com/study-guide` would parse as a book called
 * `imp-example.com` opened at a chapter called `study-guide`, and a `:` would
 * break the `<book>:<kind>:<id>` split the store migrations rely on. `~` is
 * URL-unreserved and appears in neither a slug (`[a-z0-9-]`) nor an author id.
 */
const SCOPE = '~';

function identityFor(descriptor: SmartbookDescriptor): string {
  return descriptor.authorId
    ? `imp-${descriptor.authorId}${SCOPE}${descriptor.slug}`
    : `imp-${descriptor.slug}`;
}

/**
 * The key this book would have had before it declared an author.
 *
 * A book that adds `authorId` in a new edition is still the same book to its
 * reader, so the import adopts the unscoped record rather than shelving a
 * second copy beside it. This is the one case where the two schemes have to
 * meet, and it is the ordinary one: every existing book acquires an author id
 * exactly once.
 */
function unscopedIdentityFor(descriptor: SmartbookDescriptor): string | undefined {
  return descriptor.authorId ? `imp-${descriptor.slug}` : undefined;
}

/**
 * What importing a package did to the reader's shelf (SPEC003 E1.2).
 *
 * The distinction the whole of `edition` exists for. Without it every import is
 * a silent replace, which is fine when the file is newer and quietly destructive
 * when it is not — a reader handed last month's copy loses a month of reading
 * and is told "Imported".
 *
 * `unknown` is a real answer, not a gap: a book with no edition, or one that
 * changed from dates to semver, has no ordering. Guessing would mean either
 * refusing a genuine update or silently downgrading someone.
 */
export type ImportOutcome = 'new' | 'update' | 'duplicate' | 'downgrade' | 'unknown';

export interface ImportResult {
  stored: StoredImport;
  outcome: ImportOutcome;
  /** The edition being replaced, when there was one. */
  replaced?: string;
}

/** What a package would do to this shelf, without doing it. */
export async function previewImport(pkg: ImportedPackage): Promise<{
  outcome: ImportOutcome;
  replaced?: string;
}> {
  const id = identityFor(pkg.descriptor);
  const existing =
    (await get<StoredImport>(id, importStore)) ??
    (await maybeGet(unscopedIdentityFor(pkg.descriptor)));

  if (!existing) return { outcome: 'new' };

  const replaced = existing.descriptor.edition;
  const order = compareEditions(pkg.descriptor.edition, replaced);
  if (order === undefined) return { outcome: 'unknown', replaced };

  return {
    outcome: order > 0 ? 'update' : order === 0 ? 'duplicate' : 'downgrade',
    replaced,
  };
}

async function maybeGet(id: string | undefined): Promise<StoredImport | undefined> {
  return id ? get<StoredImport>(id, importStore) : undefined;
}

export async function saveImportedBook(pkg: ImportedPackage): Promise<StoredImport> {
  return (await importBook(pkg)).stored;
}

/**
 * Store a package, reporting what it did.
 *
 * `saveImportedBook` remains as the answer-free version, because most callers
 * genuinely do not care and threading a result through them would be noise.
 */
export async function importBook(pkg: ImportedPackage): Promise<ImportResult> {
  const { outcome, replaced } = await previewImport(pkg);
  const id = identityFor(pkg.descriptor);

  // Adopt the pre-`authorId` record, if this reader has one and nothing is
  // already stored under the scoped key. Checked in that order so a book that
  // has been imported since is never overwritten by a stale predecessor.
  const previous = unscopedIdentityFor(pkg.descriptor);
  if (previous && !(await get<StoredImport>(id, importStore))) {
    const legacy = await get<StoredImport>(previous, importStore);
    if (legacy) {
      await del(previous, importStore);
      await renameBookState(previous, id);
    }
  }

  const stored: StoredImport = {
    id,
    descriptor: pkg.descriptor,
    content: pkg.content,
    assets: pkg.assets,
    importedAt: Date.now(),
  };
  await set(stored.id, stored, importStore);
  return { stored, outcome, replaced };
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
