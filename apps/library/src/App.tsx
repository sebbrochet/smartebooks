import { useEffect } from 'react';
import {
  Reader,
  ThemeToggle,
  clearBook,
  clearLastRead,
  deleteImportedBook,
  setLastRead,
} from '@smart-ebooks/engine';
import { useShelfBooks } from './useShelfBooks';
import { useAppRoute } from './router';
import { allowResume, suppressResume, useLaunchDecision } from './launch';
import { Bookshelf } from './Bookshelf';
import { CoverSplash } from './CoverSplash';
import { BackupControls } from './BackupControls';
import { BookExport } from './BookExport';
import './App.css';

export default function App() {
  const route = useAppRoute();
  const { books, getBook, reload } = useShelfBooks();
  const active = route.view === 'shelf' ? undefined : getBook(route.bookSlug);
  const activeBook = active?.book;

  const { pending, dismiss } = useLaunchDecision(route);
  const pendingBook = pending ? getBook(pending.bookSlug)?.book : undefined;

  // Track where the reader is, so the next visit can resume. Landing on the
  // shelf is treated as "I want my library" for the rest of this session.
  useEffect(() => {
    if (route.view === 'shelf') {
      suppressResume();
      return;
    }
    allowResume();
    if (activeBook) {
      setLastRead(activeBook.meta.slug, route.view === 'book' ? route.chapterSlug : undefined);
    }
  }, [route, activeBook]);

  async function resetBook(slug: string) {
    await clearBook(slug);
    location.reload();
  }

  async function handleDelete(importId: string) {
    await deleteImportedBook(importId);
    if (active?.importId === importId) window.location.hash = '/';
    clearLastRead();
    await reload();
  }

  return (
    <div className="reader">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="reader__header">
        <a className="reader__brand" href="#/">
          Smart Ebooks
        </a>
        {activeBook && <span className="reader__booktitle">{activeBook.meta.title}</span>}
        <div className="reader__actions">
          <ThemeToggle />
          <BackupControls bookSlug={activeBook?.meta.slug} />
          {activeBook && <BookExport book={activeBook} />}
          {activeBook && (
            <button
              type="button"
              className="reader__reset"
              onClick={() => resetBook(activeBook.meta.slug)}
            >
              Reset progress
            </button>
          )}
        </div>
      </header>

      {activeBook ? (
        <Reader
          book={activeBook}
          basePath={`/${activeBook.meta.slug}`}
          view={route.view === 'search' ? 'search' : 'chapter'}
          chapterSlug={route.view === 'book' ? route.chapterSlug : undefined}
          heading={route.view === 'book' ? route.heading : undefined}
          query={route.view === 'search' ? route.query : undefined}
          trusted={active?.trusted ?? true}
        />
      ) : pending && pendingBook ? (
        <CoverSplash book={pendingBook} chapterSlug={pending.chapterSlug} onDismiss={dismiss} />
      ) : (
        <Bookshelf books={books} onImported={reload} onDelete={handleDelete} />
      )}

      <footer className="reader__footer">
        Your progress and scores are stored locally in your browser. Nothing is sent to a server.
      </footer>
    </div>
  );
}
