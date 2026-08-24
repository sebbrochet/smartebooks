import type { Book } from '@smart-ebooks/engine';

/** A book on the shelf, plus how the platform should treat it. */
export interface ShelfBook {
  book: Book;
  trusted: boolean;
  /** Present only for imported books (their IndexedDB id). */
  importId?: string;
}

// Auto-discover every bundled book: drop a folder in /books with a
// book.config.ts that exports `book`, and it appears here — no wiring.
const modules = import.meta.glob('../../../books/*/book.config.ts', {
  eager: true,
  import: 'book',
}) as Record<string, Book>;

export const bundledBooks: ShelfBook[] = Object.values(modules)
  .map((book) => ({ book, trusted: true }))
  .sort((a, b) => a.book.meta.title.localeCompare(b.book.meta.title));
