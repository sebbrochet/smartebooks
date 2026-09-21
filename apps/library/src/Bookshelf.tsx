import { useState } from 'react';
import { useMessages } from '@smart-ebooks/engine';
import type { ShelfBook } from './books';
import { ImportControl } from './ImportControl';
import { ResumeSettings } from './ResumeSettings';
import { BookCover } from './BookCover';
import { ConfirmDialog } from './ConfirmDialog';

interface BookshelfProps {
  books: ShelfBook[];
  onImported: () => void;
  onDelete: (importId: string) => void;
}

export function Bookshelf({ books, onImported, onDelete }: BookshelfProps) {
  const words = useMessages();
  // Deleting used to happen on the click itself. The button sits in the corner
  // of a card whose whole face is a link, so the price of a slightly missed tap
  // was a book off the shelf with nothing to undo it.
  const [pending, setPending] = useState<{ importId: string; title: string }>();

  return (
    <main id="main" className="shelf">
      <div className="shelf__head">
        <h1>{words.library}</h1>
        <ImportControl onImported={onImported} />
      </div>
      <p className="shelf__intro">{words.shelfIntro}</p>
      <ResumeSettings />
      <ul className="shelf__grid">
        {books.map(({ book, importId }) => (
          <li key={book.meta.slug} className="shelf__card">
            <a href={`#/${book.meta.slug}`}>
              <BookCover book={book} />
              <h2>{book.meta.title}</h2>
              {book.meta.description && <p>{book.meta.description}</p>}
              <span className="shelf__meta">
                {words.chapterCount(book.chapters.length)}
                {importId && <span className="shelf__badge">{words.imported}</span>}
              </span>
            </a>
            {importId && (
              <button
                type="button"
                className="shelf__delete"
                aria-label={words.deleteImportedBook(book.meta.title)}
                onClick={() => setPending({ importId, title: book.meta.title })}
              >
                {words.deleteAction}
              </button>
            )}
          </li>
        ))}
      </ul>

      {pending && (
        <ConfirmDialog
          title={words.deleteBookTitled(pending.title)}
          confirmLabel={words.deleteBook}
          onCancel={() => setPending(undefined)}
          onConfirm={() => {
            const { importId } = pending;
            setPending(undefined);
            onDelete(importId);
          }}
        >
          <p>{words.deleteRemovesFromLibrary}</p>
          {/* Both halves are worth saying. The first is why the reader can
              press Delete without much fear; the second is why the dialog is
              here at all, since re-importing means finding the file again. */}
          <p>{words.deleteKeepsFile}</p>
        </ConfirmDialog>
      )}
    </main>
  );
}
