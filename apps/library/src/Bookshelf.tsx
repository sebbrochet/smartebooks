import { useState } from 'react';
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
  // Deleting used to happen on the click itself. The button sits in the corner
  // of a card whose whole face is a link, so the price of a slightly missed tap
  // was a book off the shelf with nothing to undo it.
  const [pending, setPending] = useState<{ importId: string; title: string }>();

  return (
    <main id="main" className="shelf">
      <div className="shelf__head">
        <h1>Library</h1>
        <ImportControl onImported={onImported} />
      </div>
      <p className="shelf__intro">
        Every book below runs on the same Smart Ebooks engine. Pick one to start reading, or import
        a<code> .smartbook</code> package.
      </p>
      <ResumeSettings />
      <ul className="shelf__grid">
        {books.map(({ book, importId }) => (
          <li key={book.meta.slug} className="shelf__card">
            <a href={`#/${book.meta.slug}`}>
              <BookCover book={book} />
              <h2>{book.meta.title}</h2>
              {book.meta.description && <p>{book.meta.description}</p>}
              <span className="shelf__meta">
                {book.chapters.length} {book.chapters.length === 1 ? 'chapter' : 'chapters'}
                {importId && <span className="shelf__badge">Imported</span>}
              </span>
            </a>
            {importId && (
              <button
                type="button"
                className="shelf__delete"
                aria-label={`Delete imported book ${book.meta.title}`}
                onClick={() => setPending({ importId, title: book.meta.title })}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {pending && (
        <ConfirmDialog
          title={`Delete ${pending.title}?`}
          confirmLabel="Delete book"
          onCancel={() => setPending(undefined)}
          onConfirm={() => {
            const { importId } = pending;
            setPending(undefined);
            onDelete(importId);
          }}
        >
          <p>This removes the book from your library.</p>
          {/* Both halves are worth saying. The first is why the reader can
              press Delete without much fear; the second is why the dialog is
              here at all, since re-importing means finding the file again. */}
          <p>
            The <code>.smartbook</code> file on your computer is not touched, and your progress and
            scores are kept if you import this book again.
          </p>
        </ConfirmDialog>
      )}
    </main>
  );
}
