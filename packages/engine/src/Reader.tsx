import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from './types';
import { createIslandRegistry } from './islandRegistry';
import { missingIslands } from './package/islandRequirements';
import { BookProvider } from './reader/BookContext';
import { useAssetResolver } from './reader/useAssetResolver';
import { reading } from './store/store';
import { Sidebar } from './reader/Sidebar';
import { ChapterView } from './reader/ChapterView';
import { SearchView } from './reader/SearchView';
import { TableOfContents } from './reader/TableOfContents';
import { BackToTop } from './reader/BackToTop';
import { SearchOverlay } from './reader/SearchOverlay';
import { useActiveSection, scrollToSpot } from './reader/useActiveSection';
import { furthestOf } from './reader/furthest';
import './reader/reader.css';
import { chapterHeadings, headingHref } from './markdown/headings';
import { ProgressDashboard } from './components/ProgressDashboard';

export interface ReaderProps {
  /** The book to render (metadata + chapters). */
  book: Book;
  /**
   * Hash path prefix (without the leading `#`) that scopes this book's links.
   * Platform usage: `/<bookSlug>`. Standalone single-book usage: `''`.
   */
  basePath: string;
  /** Current within-book view. */
  view: 'chapter' | 'search';
  /** Active chapter slug (defaults to the first chapter when omitted). */
  chapterSlug?: string;
  /** Section within the chapter to open at, from the route's `?s=`. */
  heading?: string;
  /** Terms to mark in the prose, from the route's `?h=`. */
  highlight?: string[];
  /** Search query when `view === 'search'`. */
  query?: string;
  /** Whether the book is trusted. Imported books pass `false` (sanitized). */
  trusted: boolean;
}

/**
 * The reusable book reader: sidebar navigation + search + a chapter or search
 * results, with a live per-book progress dashboard. Presentational — the host
 * (platform or standalone app) owns routing and passes the resolved view.
 */
export function Reader({
  book,
  basePath,
  view,
  chapterSlug,
  heading,
  highlight,
  query,
  trusted,
}: ReaderProps) {
  const mainRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const resolveAsset = useAssetResolver(book.assets);

  // Every book is scoped to exactly the islands it declares.
  const registry = useMemo(() => createIslandRegistry(book.islands), [book]);

  // Islands the book says it needs but this reader has no implementation for.
  // Reported once here rather than as scattered placeholders (SPEC001 P2.1).
  const missing = useMemo(() => missingIslands(book.descriptor, book.islands), [book]);

  const activeChapter =
    view === 'chapter'
      ? ((chapterSlug ? book.chapters.find((c) => c.slug === chapterSlug) : book.chapters[0]) ??
        book.chapters[0])
      : undefined;

  // Computed here rather than inside the chapter, because the contents rail is
  // a sibling of the reading column on a wide screen — it cannot be a child of
  // the thing it sits beside.
  const headings = useMemo(
    () => (activeChapter ? chapterHeadings(activeChapter.markdown) : []),
    [activeChapter],
  );

  const spot = useActiveSection(headings);
  const activeSlug = activeChapter?.slug;

  useEffect(() => {
    mainRef.current?.focus();

    // Arriving at a section scrolls to it rather than to the top, which is the
    // difference between a deep link and a link to the chapter that happens to
    // contain the thing you were sent. The element only exists once the chapter
    // has rendered, so a miss falls back to the top rather than doing nothing.
    const target = heading ? document.getElementById(heading) : null;
    if (target) {
      target.scrollIntoView();
      return;
    }

    // No section asked for: pick up where this reader left off in this
    // chapter. Every view change used to scroll to the top, so resuming
    // returned the reader to the chapter but never to the place — on a long
    // chapter that is most of the way to not resuming at all (SPEC002 S4).
    window.scrollTo(0, 0);
    if (view !== 'chapter' || !activeSlug) return;

    let cancelled = false;
    void reading.get(book.meta.slug).then((saved) => {
      // Only if they have not started reading in the meantime. Yanking the
      // page out from under someone who scrolled while IndexedDB was answering
      // is worse than simply not restoring.
      if (cancelled || !saved || saved.chapterSlug !== activeSlug) return;
      if (window.scrollY !== 0) return;
      scrollToSpot(saved);
    });

    return () => {
      cancelled = true;
    };
  }, [view, chapterSlug, heading, query, book.meta.slug, activeSlug]);

  /*
   * Remember where the reader got to. Stored per book, so it travels with a
   * progress backup.
   *
   * Written on a delay rather than on every frame: this is an IndexedDB write,
   * and scrolling produces one candidate position per frame. A second of quiet
   * means the reader has stopped somewhere worth remembering.
   */
  useEffect(() => {
    if (view !== 'chapter' || !activeSlug) return;

    const timer = setTimeout(() => {
      void reading.get(book.meta.slug).then((saved) =>
        reading.set(book.meta.slug, {
          chapterSlug: activeSlug,
          sectionId: spot.sectionId,
          offset: spot.offset,
          furthest: furthestOf(book.chapters, saved?.furthest, activeSlug),
        }),
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [book.meta.slug, book.chapters, view, activeSlug, spot.sectionId, spot.offset]);

  // `/` opens search from anywhere, the convention every documentation site and
  // code host shares. Guarded against firing while the reader is typing — a
  // book with a text island would otherwise swallow the character instead of
  // letting them write it.
  useEffect(() => {
    function onSlash(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable === true ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (typing) return;

      event.preventDefault();
      setSearchOpen(true);
    }

    document.addEventListener('keydown', onSlash);
    return () => document.removeEventListener('keydown', onSlash);
  }, []);

  // Escape closes the drawer, and focus goes back to the control that opened
  // it — otherwise it is left on a panel that no longer exists and the next
  // Tab starts from the top of the document.
  useEffect(() => {
    if (!navOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setNavOpen(false);
      navToggleRef.current?.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    // The drawer covers the page; scrolling the chapter underneath it is
    // motion the reader did not ask for.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  return (
    <BookProvider
      slug={book.meta.slug}
      trusted={trusted}
      resolveAsset={resolveAsset}
      registry={registry}
    >
      <div className="reader__body">
        <div className="reader__toolbar">
          <button
            type="button"
            ref={navToggleRef}
            className="reader__nav-toggle"
            aria-expanded={navOpen}
            aria-controls="book-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span> Contents
          </button>
          <button
            type="button"
            className="reader__search-toggle"
            onClick={() => setSearchOpen(true)}
          >
            <span aria-hidden="true">⌕</span> Search
          </button>
        </div>
        {navOpen && (
          <div
            className="reader__scrim"
            // Decoration for the pointer only: Escape and the toggle are the
            // routes out that assistive technology is told about.
            aria-hidden="true"
            onClick={() => setNavOpen(false)}
          />
        )}
        <Sidebar
          book={book}
          basePath={basePath}
          view={view}
          activeSlug={activeChapter?.slug}
          open={navOpen}
          onNavigate={() => setNavOpen(false)}
          onSearch={() => {
            setNavOpen(false);
            setSearchOpen(true);
          }}
        />
        <main id="main" ref={mainRef} tabIndex={-1} className="reader__main">
          {missing.length > 0 && (
            <div className="reader__notice" role="note">
              This book uses interactive blocks this reader cannot display:{' '}
              {missing.map((name, i) => (
                <span key={name}>
                  {i > 0 && ', '}
                  <code>{name}</code>
                </span>
              ))}
              . The text is complete; those blocks appear as placeholders.
            </div>
          )}
          <ProgressDashboard />
          {view === 'search' ? (
            <SearchView book={book} basePath={basePath} query={query ?? ''} />
          ) : (
            activeChapter && (
              <ChapterView
                book={book}
                basePath={basePath}
                chapter={activeChapter}
                trusted={trusted}
                resolveAsset={resolveAsset}
                registry={registry}
                highlight={highlight}
              />
            )
          )}
        </main>
        {view === 'chapter' && activeChapter && (
          <TableOfContents
            headings={headings}
            linkTo={(id) => headingHref(basePath, activeChapter.slug, id)}
            activeId={spot.sectionId ?? heading}
          />
        )}
        <BackToTop target={mainRef} />
      </div>
      <SearchOverlay
        book={book}
        basePath={basePath}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </BookProvider>
  );
}
