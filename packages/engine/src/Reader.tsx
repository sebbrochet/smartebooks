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
  /** Section within the chapter to open at, from the route's `?h=`. */
  heading?: string;
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
  query,
  trusted,
}: ReaderProps) {
  const mainRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const [navOpen, setNavOpen] = useState(false);
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

  useEffect(() => {
    mainRef.current?.focus();

    // Arriving at a section scrolls to it rather than to the top, which is the
    // difference between a deep link and a link to the chapter that happens to
    // contain the thing you were sent. The element only exists once the chapter
    // has rendered, so a miss falls back to the top rather than doing nothing.
    const target = heading ? document.getElementById(heading) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [view, chapterSlug, heading, query, book.meta.slug]);

  // Remember where the reader got to, so the book can be resumed later. Stored
  // per book, so it also travels with a progress backup.
  const activeSlug = activeChapter?.slug;
  useEffect(() => {
    if (activeSlug) void reading.set(book.meta.slug, activeSlug);
  }, [book.meta.slug, activeSlug]);

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
          query={query}
          open={navOpen}
          onNavigate={() => setNavOpen(false)}
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
              />
            )
          )}
        </main>
        {view === 'chapter' && activeChapter && (
          <TableOfContents
            headings={headings}
            linkTo={(id) => headingHref(basePath, activeChapter.slug, id)}
            activeId={heading}
          />
        )}
        <BackToTop target={mainRef} />
      </div>
    </BookProvider>
  );
}
