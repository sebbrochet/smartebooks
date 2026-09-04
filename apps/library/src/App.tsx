import { useEffect, useState } from 'react';
import {
  Reader,
  ThemeToggle,
  ReadingSettings,
  clearBook,
  clearLastRead,
  deleteImportedBook,
  getLastRead,
  reading,
  setLastRead,
  useMediaQuery,
  NARROW,
} from '@smart-ebooks/engine';
import { useShelfBooks } from './useShelfBooks';
import { useServiceWorker } from './useServiceWorker';
import { useAppRoute } from './router';
import { allowResume, hashFor, resumeChapter, suppressResume, useLaunchDecision } from './launch';
import { Bookshelf } from './Bookshelf';
import { ConfirmDialog } from './ConfirmDialog';
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

  // A new build of the *app*, which is not the same thing as a new edition of a
  // book and must not look like one (SPEC003 E2.1).
  const { updateReady, update } = useServiceWorker();

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
     * A part page, a search, and `#/<slug>` itself are all places *in* a book
     * that name no chapter — and writing `undefined` here would throw away the
     * chapter the reader was actually on, which is the pointer the next line of
     * this file depends on.
     *
     * So the chapter is carried over whenever the pointer already refers to
     * this same book. Opening a book never read before records the book alone,
     * which is all that is known.
     */
    const slug = activeBook.meta.slug;
    const named = route.view === 'book' ? route.chapterSlug : undefined;
    if (named) {
      setLastRead(slug, named);
      return;
    }
    const previous = getLastRead();
    setLastRead(slug, previous?.bookSlug === slug ? previous.chapterSlug : undefined);
  }, [route, activeBook]);

  /*
   * Opening a book without naming a chapter means "take me back to it", not
   * "start it again" — see `resumeChapter`.
   *
   * The URL is *replaced* rather than pushed: the reader came here from the
   * library, and Back should return them there rather than to a redirect they
   * never saw.
   */
  const wantsResume = route.view === 'book' && !route.chapterSlug;
  const resumeSlug = wantsResume ? activeBook?.meta.slug : undefined;
  const chapters = activeBook?.chapters;

  useEffect(() => {
    if (!resumeSlug || !chapters) return;

    // The synchronous answer first, so the common case — the book just closed —
    // never paints chapter one on the way.
    const now = resumeChapter({ chapters, slug: resumeSlug, lastRead: getLastRead() });
    if (now) {
      window.location.replace(hashFor(resumeSlug, now));
      return;
    }

    let cancelled = false;
    void reading.get(resumeSlug).then((saved) => {
      if (cancelled) return;
      const target = resumeChapter({ chapters, slug: resumeSlug, saved });
      if (target) window.location.replace(hashFor(resumeSlug, target));
    });

    return () => {
      cancelled = true;
    };
  }, [resumeSlug, chapters]);

  /*
   * Reset is the most destructive control in the app, and the only one with no
   * way back: a deleted import returns with its progress intact if the reader
   * still has the file, but scores and checkpoints thrown away here are gone.
   * It sat behind a single click while delete had a confirmation.
   */
  const [resetting, setResetting] = useState<{ slug: string; title: string }>();

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
      {updateReady && (
        /*
         * A strip, not a dialog. The reader is mid-sentence and this is not
         * urgent — the version they are running works, and the new one will
         * still be there later. `role="status"` rather than `alert` for the
         * same reason: announce it, do not interrupt.
         */
        <div className="app-update" role="status">
          <span>A new version of Smart Ebooks is ready.</span>
          <button type="button" onClick={update}>
            Reload to update
          </button>
        </div>
      )}
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
                onClick={() =>
                  setResetting({ slug: activeBook.meta.slug, title: activeBook.meta.title })
                }
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

      {resetting && (
        <ConfirmDialog
          title={`Reset your progress in ${resetting.title}?`}
          confirmLabel="Reset progress"
          onCancel={() => setResetting(undefined)}
          onConfirm={() => {
            const { slug } = resetting;
            setResetting(undefined);
            void resetBook(slug);
          }}
        >
          <p>
            This clears every quiz score, checkpoint and reading position for this book on this
            device.
          </p>
          {/* Delete's dialog can promise the book comes back. This one cannot,
              so it points at the only thing that would have made it reversible
              — and says so before the reader finds out afterwards. */}
          <p>
            It cannot be undone. If you want to keep a copy, cancel and use <b>Export progress</b>{' '}
            first.
          </p>
        </ConfirmDialog>
      )}

      <footer className="reader__footer">
        Your progress and scores are stored locally in your browser. Nothing is sent to a server.
      </footer>
    </div>
  );
}
