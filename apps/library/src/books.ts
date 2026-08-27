import {
  makeBook,
  packBookAssets,
  type Book,
  type SmartbookDescriptor,
} from '@smart-ebooks/engine';
import { resolveIslands } from './islandPacks';

/** A book on the shelf, plus how the platform should treat it. */
export interface ShelfBook {
  book: Book;
  trusted: boolean;
  /** Present only for imported books (their IndexedDB id). */
  importId?: string;
}

// Auto-discover every bundled book: drop a folder in /books with a
// smartbook.json, and it appears here — no wiring, and no code in the book.
const descriptors = import.meta.glob('../../../books/*/smartbook.json', {
  eager: true,
  import: 'default',
}) as Record<string, SmartbookDescriptor>;

const content = import.meta.glob('../../../books/*/content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Assets travel as bytes on the book, exactly like an imported `.smartbook`:
// resolved to Blob URLs at render and included on export. Text assets
// round-trip through `?raw`; binaries come in as data URLs.
const textAssets = import.meta.glob('../../../books/*/assets/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const binaryAssets = import.meta.glob(
  '../../../books/*/assets/*.{png,jpg,jpeg,gif,webp,wav,mp3,ogg,mp4,webm}',
  { query: '?inline', import: 'default', eager: true },
) as Record<string, string>;

/** `…/books/<slug>/rest/of/path` → `[slug, 'rest/of/path']`. */
function splitBookPath(path: string): [slug: string, rest: string] | undefined {
  const match = path.match(/\/books\/([^/]+)\/(.+)$/);
  return match ? [match[1], match[2]] : undefined;
}

/** Group a glob result by book slug, re-keyed to the book-relative path. */
function byBook(modules: Record<string, string>): Record<string, Record<string, string>> {
  const grouped: Record<string, Record<string, string>> = {};
  for (const [path, value] of Object.entries(modules)) {
    const parts = splitBookPath(path);
    if (!parts) continue;
    const [slug, rest] = parts;
    (grouped[slug] ??= {})[rest] = value;
  }
  return grouped;
}

const contentByBook = byBook(content);
const textAssetsByBook = byBook(textAssets);
const binaryAssetsByBook = byBook(binaryAssets);

function buildBook(descriptor: SmartbookDescriptor, folder: string): Book {
  const assets = packBookAssets({
    ...textAssetsByBook[folder],
    ...binaryAssetsByBook[folder],
  });

  const book = makeBook(descriptor, contentByBook[folder] ?? {}, resolveIslands(descriptor));
  return Object.keys(assets).length > 0 ? { ...book, assets } : book;
}

export const bundledBooks: ShelfBook[] = Object.entries(descriptors)
  .flatMap(([path, descriptor]) => {
    const parts = splitBookPath(path);
    return parts ? [{ book: buildBook(descriptor, parts[0]), trusted: true }] : [];
  })
  .sort((a, b) => a.book.meta.title.localeCompare(b.book.meta.title));
