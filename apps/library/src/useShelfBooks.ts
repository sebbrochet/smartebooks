import { useCallback, useEffect, useState } from 'react';
import { listImportedBooks, makeImportedBook } from '@smart-ebooks/engine';
import { bundledBooks, type ShelfBook } from './books';

/**
 * The full shelf: bundled books (compiled in) plus imported books (loaded from
 * IndexedDB). Re-load after an import or delete.
 */
export function useShelfBooks() {
  const [imported, setImported] = useState<ShelfBook[]>([]);

  const reload = useCallback(async () => {
    const stored = await listImportedBooks();
    setImported(
      stored.map((entry) => ({
        book: makeImportedBook(entry),
        trusted: false,
        importId: entry.id,
      })),
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const books = [...bundledBooks, ...imported];
  const getBook = (slug: string) => books.find((b) => b.book.meta.slug === slug);

  return { books, getBook, reload };
}
