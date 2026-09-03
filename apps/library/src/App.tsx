import { useEffect, useState } from 'react';
import {
  Reader,
  ThemeToggle,
  ReadingSettings,
  clearBook,
  clearLastRead,
  deleteImportedBook,
  getLastRead,
  setLastRead,
  useMediaQuery,
  NARROW,
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

  /*
   * On a phone the header used to wrap to **154px of a 780px screen** — brand,
   * book title and five buttons, none of which folded. A fifth of the viewport
   * spent on controls a reader touches once a month, before a word of the book.
   *
   * The theme toggle stays out: it is the one control readers use while
   * reading. Everything else — progress backup, export, reset — goes behind a
   * disclosure (SPEC002, header note).
   */
  const narrow = useMediaQuery(NARROW);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsVisible = !narrow || toolsOpen;

  // Reopening on every navigation would put the panel back over the text.
  useEffect(() => setToolsOpen(false), [route]);

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
    if (!activeBook) return;

    /*
     * A part page and a search are places *in* a book, not chapters of it, so
     * neither can name one — and writing `undefined` here would throw away the
     * chapter the reader was actually on. They would then reopen the book at
     * chapter one, having done nothing but glance at a contents page.
     *
     * So the chapter is carried over whenever the pointer already refers to
     * this same book. Landing on a part page of a book never opened before
     * records the book alone, which is all that is known.
     */
    const slug = activeBook.meta.slug;
    if (route.view === 'book') {
      setLastRead(slug, route.chapterSlug);
      return;
    }
    const previous = getLastRead();
    setLastRead(slug, previous?.bookSlug === slug ? previous.chapterSlug : undefined);
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
          <ReadingSettings />
          {narrow && (
            <button
              type="button"
              className="reader__reset reader__tools-toggle"
              aria-expanded={toolsOpen}
              aria-controls="reader-tools"
              onClick={() => setToolsOpen((open) => !open)}
            >
              <span aria-hidden="true">⋯</span> Tools
            </button>
          )}
          <div className="reader__tools" id="reader-tools" hidden={!toolsVisible}>
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
        </div>
      </header>

      {activeBook ? (
        <Reader
          book={activeBook}
          basePath={`/${activeBook.meta.slug}`}
          view={route.view === 'search' ? 'search' : route.view === 'part' ? 'part' : 'chapter'}
          chapterSlug={route.view === 'book' ? route.chapterSlug : undefined}
          partId={route.view === 'part' ? route.partId : undefined}
          heading={route.view === 'book' ? route.heading : undefined}
          highlight={route.view === 'book' ? route.highlight : undefined}
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
