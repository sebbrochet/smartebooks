import { useEffect, useMemo, useRef } from 'react';
import type { Book } from './types';
import { createIslandRegistry } from './islandRegistry';
import { BookProvider } from './reader/BookContext';
import { useAssetResolver } from './reader/useAssetResolver';
import { reading } from './store/store';
import { Sidebar } from './reader/Sidebar';
import { ChapterView } from './reader/ChapterView';
import { SearchView } from './reader/SearchView';
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
export function Reader({ book, basePath, view, chapterSlug, query, trusted }: ReaderProps) {
  const mainRef = useRef<HTMLElement>(null);
  const resolveAsset = useAssetResolver(book.assets);

  // Every book is scoped to exactly the islands it declares.
  const registry = useMemo(() => createIslandRegistry(book.islands), [book]);

  const activeChapter =
    view === 'chapter'
      ? ((chapterSlug ? book.chapters.find((c) => c.slug === chapterSlug) : book.chapters[0]) ??
        book.chapters[0])
      : undefined;

  useEffect(() => {
    mainRef.current?.focus();
    window.scrollTo(0, 0);
  }, [view, chapterSlug, query, book.meta.slug]);

  // Remember where the reader got to, so the book can be resumed later. Stored
  // per book, so it also travels with a progress backup.
  const activeSlug = activeChapter?.slug;
  useEffect(() => {
    if (activeSlug) void reading.set(book.meta.slug, activeSlug);
  }, [book.meta.slug, activeSlug]);

  return (
    <BookProvider
      slug={book.meta.slug}
      trusted={trusted}
      resolveAsset={resolveAsset}
      registry={registry}
    >
      <div className="reader__body">
        <Sidebar
          book={book}
          basePath={basePath}
          view={view}
          activeSlug={activeChapter?.slug}
          query={query}
        />
        <main id="main" ref={mainRef} tabIndex={-1} className="reader__main">
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
      </div>
    </BookProvider>
  );
}
