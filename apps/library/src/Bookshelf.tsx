import type { ShelfBook } from './books';
import { ImportControl } from './ImportControl';
import { ResumeSettings } from './ResumeSettings';
import { BookCover } from './BookCover';

interface BookshelfProps {
  books: ShelfBook[];
  onImported: () => void;
  onDelete: (importId: string) => void;
}

export function Bookshelf({ books, onImported, onDelete }: BookshelfProps) {
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
                onClick={() => onDelete(importId)}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
