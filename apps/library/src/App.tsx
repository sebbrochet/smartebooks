import { useEffect, useMemo, useState } from 'react';
import {
  Reader,
  ReaderBar,
  Icon,
  clearBook,
  clearLastRead,
  deleteImportedBook,
  getLastRead,
  reading,
  setLastRead,
} from '@smart-ebooks/engine';
import { useShelfBooks } from './useShelfBooks';
import { useServiceWorker } from './useServiceWorker';
import { warmIslandPacks } from './islandPacks';
import { journeyGate, usePlaythroughOf } from '@smart-ebooks/islands-gamebook';
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
   * A gamebook answers the shell's gate from its own journey (SPEC002 R1.1a).
   *
   * Wired here because the gate is a *book-level* rule and the engine must not
   * learn that gamebooks exist — the same boundary that keeps the library out
   * of the reader. A book that declares no pack passes no gate, and the shell's
   * default is open, so nothing else changes.
   */
  const [play] = usePlaythroughOf(activeBook?.meta.slug ?? '');
  const gate = useMemo(
    () => (activeBook?.descriptor.islands?.packs?.gamebook ? journeyGate(play) : undefined),
    [activeBook, play],
  );

  /*
   * The header used to wrap to **154px of a 780px screen** on a phone — brand,
   * book title and five buttons, none of which folded. A fifth of the viewport
   * spent on controls a reader touches once a month, before a word of the book.
   *
   * The theme toggle stays out: it is the one control readers use while
   * reading. Everything else — progress backup, export, reset — goes behind a
   * disclosure (SPEC002, header note), now at **every** width: that reasoning
   * was never a fact about phones, and inline above 720px the bar still
   * measured 97px in four rows (SPEC009 T10).
   */
  const [toolsOpen, setToolsOpen] = useState(false);

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
   * Pull down the code this book's islands need, the first time it is opened
   * in this session.
   *
   * Import does this too, and import is the better moment — the reader is
   * demonstrably online and the book is complete before it is ever needed. But
   * import only helps books imported *after* that shipped: a shelf full of
   * books added earlier would stay one tunnel away from `This chess-board
   * could not be displayed`, and re-importing every one of them is not a thing
   * to ask of anybody.
   *
   * Cheap to repeat. Everything here is already cached after the first success,
   * so this is a no-op on every open but the first, and best-effort besides —
   * a reader opening a book offline gets exactly what they get today.
   */
  const openedSlug = activeBook?.meta.slug;
  useEffect(() => {
    if (!activeBook) return;
    void warmIslandPacks(activeBook.descriptor);
    // Keyed on the slug rather than the book: an imported book is rebuilt on
    // every shelf reload, and warming once per book is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedSlug]);

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

  /*
   * The host's own actions: backup, export, reset. They are about packaging and
   * the library rather than about reading, which is why the engine takes them
   * as a slot instead of owning them (SPEC009 T10). The same cluster serves the
   * shelf's header and the reader's bar.
   */
  const tools = (
    <>
      <button
        type="button"
        className="ui-btn reader__tools-toggle"
        aria-expanded={toolsOpen}
        aria-controls="reader-tools"
        aria-label="Tools"
        title="Tools"
        onClick={() => setToolsOpen((open) => !open)}
      >
        <Icon name="more" />
        <span className="ui-btn__label">Tools</span>
      </button>
      <div className="reader__tools" id="reader-tools" hidden={!toolsOpen}>
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
    </>
  );

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
      {/*
       * Only when no book is open. With a book, the engine renders the one bar
       * and this would be a second one (SPEC009 V10) — which is also why the
       * shelf borrows the engine's bar rather than keeping a second layout:
       * two headers that look alike drift apart, and this one already had.
       */}
      {!activeBook && (
        <ReaderBar
          leading={
            <a className="reader__brand" href="#/">
              Smart Ebooks
            </a>
          }
          actions={tools}
        />
      )}

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
          gate={gate}
          /*
           * The way back to the shelf. It lives here rather than in the engine
           * because the engine renders *a book* and must not learn that a
           * library exists — a single-book installable reader would have
           * nowhere to go (SPEC009 T10).
           */
          leading={
            <a className="ui-btn reader__home" href="#/" aria-label="Library" title="Library">
              <Icon name="back" />
              <span className="ui-btn__label">Library</span>
            </a>
          }
          actions={tools}
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
