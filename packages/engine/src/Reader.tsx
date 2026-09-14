import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Book, Chapter } from './types';
import { createIslandRegistry } from './islandRegistry';
import { missingIslands } from './package/islandRequirements';
import { BookProvider } from './reader/BookContext';
import { useAssetResolver } from './reader/useAssetResolver';
import { reading } from './store/store';
import { Sidebar } from './reader/Sidebar';
import { ReaderBar } from './reader/ReaderBar';
import { ChapterView } from './reader/ChapterView';
import { SearchView } from './reader/SearchView';
import { PartView } from './reader/PartView';
import { findSection } from './store/bookProgress';
import { TableOfContents } from './reader/TableOfContents';
import { BackToTop } from './reader/BackToTop';
import { SearchOverlay } from './reader/SearchOverlay';
import { useActiveSection, scrollToSpot } from './reader/useActiveSection';
import { furthestOf } from './reader/furthest';
import './reader/reader.css';
import { chapterHeadings, sectionLinker, type Unit } from './markdown/headings';
import { allowedUnits, railEntries } from './reader/units';
import { bookUnits } from './reader/bookUnits';
import { bookTotals } from './markdown/scorables';
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
  view: 'chapter' | 'search' | 'part';
  /** Active chapter slug (defaults to the first chapter when omitted). */
  chapterSlug?: string;
  /** Which part to show when `view === 'part'`. */
  partId?: string;
  /** Section within the chapter to open at, from the route's `?s=`. */
  heading?: string;
  /** Terms to mark in the prose, from the route's `?h=`. */
  highlight?: string[];
  /** Search query when `view === 'search'`. */
  query?: string;
  /** Whether the book is trusted. Imported books pass `false` (sanitized). */
  trusted: boolean;
  /**
   * The host's control at the start of the bar — typically the way back to its
   * library. Optional: a single-book reader has no shelf (SPEC009 T10).
   */
  leading?: ReactNode;
  /** The host's own actions at the end of the bar: export, reset, backup. */
  actions?: ReactNode;
  /**
   * Which units of the current chapter this reader may open, and in what order
   * they are listed (SPEC002 R1.1a). Defaults to all of them.
   *
   * A **parameter, not a platform concept.** Only one domain has asked for it
   * — a gamebook, where the contents list is the reader's own history and a
   * section they have not reached must not be listed, linked or delivered. The
   * shell asks; the book's own pack answers. If a second domain ever needs it,
   * that is the point to give it a name.
   */
  gate?: (units: Unit[]) => Unit[];
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
  partId,
  heading,
  highlight,
  query,
  trusted,
  leading,
  actions,
  gate,
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

  // Whether this book measures the reader at all — parses the content, so it is
  // memoised against the book rather than recomputed per view.
  // One walk of the content, not two: the totals answer both "does this book
  // measure the reader at all" and "out of what" (SPEC009 T12).
  const totals = useMemo(() => bookTotals(book, registry), [book, registry]);
  const scored = totals.sections + totals.points > 0;

  const activePart = useMemo(
    () => (view === 'part' && partId ? findSection(book, partId) : undefined),
    [book, view, partId],
  );

  /*
   * Every unit the book carries, and the ones this reader may open (R1.1a).
   *
   * **Book-wide, not chapter-wide.** A gamebook's choice may cross a file
   * boundary, and the reader is never told that it did — section 217 is section
   * 217 wherever the author filed it. Asked once for the whole book so that
   * crossing an act costs nothing extra.
   *
   * Still two steps: the walk depends on the book, the gate on a journey that
   * changes with every choice.
   */
  const carried = useMemo(
    () => bookUnits(book.chapters, book.descriptor.unitDepth),
    [book.chapters, book.descriptor.unitDepth],
  );

  const units = useMemo(() => allowedUnits(carried.all, gate), [carried, gate]);

  const delivered = units.find((unit) => unit.id === heading) ?? units[0];

  // The id rather than the unit: the object is rebuilt on every render, and a
  // save effect that depends on it would re-arm its timer forever and never fire.
  const deliveredId = delivered?.id;

  /*
   * Which file is on screen.
   *
   * For a book addressed by unit, the route need not carry a chapter at all,
   * so the delivered unit decides it. Also resolved when a part view finds no
   * such part, because that falls back to the chapter rather than to an error
   * page.
   */
  const activeChapter =
    view === 'chapter' || (view === 'part' && !activePart)
      ? ((delivered ? carried.chapterOf.get(delivered.id) : undefined) ??
        (chapterSlug ? book.chapters.find((c) => c.slug === chapterSlug) : book.chapters[0]) ??
        book.chapters[0])
      : undefined;

  // Computed here rather than inside the chapter, because the contents rail is
  // a sibling of the reading column on a wide screen — it cannot be a child of
  // the thing it sits beside.
  const headings = useMemo(
    () => (activeChapter ? chapterHeadings(activeChapter.markdown) : []),
    [activeChapter],
  );

  const rail = useMemo(
    () => railEntries(units, headings, book.descriptor.unitDepth ?? 2),
    [units, headings, book.descriptor.unitDepth],
  );

  /*
   * The chapters the navigation may name.
   *
   * A book addressed by unit lists only the files its reader has actually
   * entered. Listing all seven acts of a gamebook would name them, which is a
   * spoiler on its own, and would hand over the last act to anyone who clicked
   * it — the gate closed at the section and left open one level up.
   */
  const navChapters = useMemo(() => {
    if (!book.descriptor.unitDepth) return book.chapters;

    const entered = new Set(units.map((unit) => carried.chapterOf.get(unit.id)?.slug));
    return book.chapters.filter((chapter) => entered.has(chapter.slug));
  }, [book.chapters, book.descriptor.unitDepth, units, carried]);

  /*
   * What search may see. Undefined for an ordinary book, which is the whole of
   * it; for a gated book, the units the reader may open and nothing else, so a
   * result can never name a section they have not reached.
   *
   * Grouped back into the files the units came from, because a search result
   * names the chapter it was found in. Deduplicated because a journey records
   * revisits and a reader should not be offered the same section twice.
   */
  const searchScope = useMemo(() => {
    if (units.length === 0) return undefined;

    const byChapter = new Map<string, { chapter: Chapter; parts: string[] }>();
    const seen = new Set<string>();

    for (const unit of units) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);

      const chapter = carried.chapterOf.get(unit.id);
      if (!chapter) continue;

      const group = byChapter.get(chapter.slug) ?? { chapter, parts: [] };
      group.parts.push(unit.markdown);
      byChapter.set(chapter.slug, group);
    }

    return [...byChapter.values()].map(({ chapter, parts }) => ({
      ...chapter,
      markdown: parts.join('\n\n'),
    }));
  }, [units, carried]);

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
          // Naturally absent for a book with no units, where the file is the page.
          ...(deliveredId ? { unit: deliveredId } : {}),
          sectionId: spot.sectionId,
          offset: spot.offset,
          furthest: furthestOf(book.chapters, saved?.furthest, activeSlug),
        }),
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [book.meta.slug, book.chapters, view, activeSlug, spot.sectionId, spot.offset, deliveredId]);

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
      language={book.meta.language}
    >
      <ReaderBar
        title={book.meta.title}
        leading={leading}
        actions={actions}
        navigation={{
          navOpen,
          onToggleNav: () => setNavOpen((open) => !open),
          navToggleRef,
          onOpenSearch: () => setSearchOpen(true),
        }}
      />
      <div className="reader__body">
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
          activePart={activePart?.id}
          chapters={navChapters}
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
          {/*
           * The dashboard exists only for books that measure the reader
           * (SPEC002 S11). A novel has nothing to score, so rendering it there
           * reports `0 sections done · 0/0 quiz points` for ever — three
           * numbers nothing the reader does can move.
           *
           * Guarded on the *book*, never on the reader's stored scores: a book
           * full of quizzes must still show its zeros on the first day, where
           * the zero is a position rather than an absence.
           */}
          {scored && <ProgressDashboard totals={totals} />}
          {view === 'search' ? (
            <SearchView book={book} basePath={basePath} query={query ?? ''} />
          ) : view === 'part' ? (
            // An unknown part id falls back to the chapter view rather than to
            // an error page: the runtime is forgiving, and a stale link to a
            // part that has been renamed should still land the reader in the
            // book (`part-unknown` is what tells the author).
            activePart ? (
              <PartView book={book} basePath={basePath} section={activePart} registry={registry} />
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
                  section={heading}
                  units={units}
                />
              )
            )
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
                section={heading}
                units={units}
              />
            )
          )}
        </main>
        {view === 'chapter' && activeChapter && (
          <TableOfContents
            headings={rail}
            linkTo={sectionLinker(basePath, activeChapter.slug, Boolean(book.descriptor.unitDepth))}
            activeId={delivered ? delivered.id : (spot.sectionId ?? heading)}
          />
        )}
        <BackToTop target={mainRef} />
      </div>
      <SearchOverlay
        book={book}
        basePath={basePath}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope={searchScope}
      />
    </BookProvider>
  );
}
