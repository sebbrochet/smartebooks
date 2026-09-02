import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../types';
import { highlight } from './search';
import { buildIndex, queryIndex, completeTerm, tokenize, type PassageHit } from './searchIndex';
import { headingHref, type Heading } from '../markdown/headings';

interface SearchOverlayProps {
  book: Book;
  basePath: string;
  open: boolean;
  onClose: () => void;
}

/**
 * One selectable destination. Chapters and their sections share a single list
 * so the arrow keys walk what the reader sees, in the order they see it.
 */
interface Row {
  key: string;
  href: string;
  kind: 'chapter' | 'passage';
  label: string;
  snippet?: string;
}

/**
 * Search, as something that happens *over* the book rather than instead of it.
 *
 * It used to be a route: typing a query navigated to `#/<book>/search?q=…`,
 * which replaced the chapter, discarded the scroll position, and made "I only
 * wanted to check a word" cost the reader their place (SPEC002 N8). An overlay
 * closes back onto the exact same pixel.
 *
 * Results are **passages grouped under their chapter** (N10), ranked (N11), and
 * each links to the section it was found in rather than to the top of nine
 * pages (N15).
 */
export function SearchOverlay({ book, basePath, open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  // Built once per book, and only once the overlay has been opened — a reader
  // who never searches never pays to parse the book twice.
  const index = useMemo(
    () => (open ? buildIndex(book.chapters) : undefined),
    [book.chapters, open],
  );
  const outcome = useMemo(() => (index ? queryIndex(index, query) : undefined), [index, query]);

  const rows = useMemo<Row[]>(() => {
    if (!outcome) return [];
    return outcome.chapters.flatMap((chapter) => {
      // The passage above a chapter's first heading *is* the chapter opening,
      // so it would otherwise render as a second row with the same title and
      // the same destination. Its snippet goes on the chapter row instead.
      const opening = chapter.passages.find((passage) => !passage.heading);
      const sections = chapter.passages.filter(
        (passage): passage is PassageHit & { heading: Heading } => passage.heading !== undefined,
      );

      return [
        {
          key: chapter.slug,
          href: `#${basePath}/${chapter.slug}`,
          kind: 'chapter' as const,
          label: chapter.title,
          snippet: opening?.snippet,
        },
        ...sections.map((passage) => ({
          key: `${chapter.slug}#${passage.heading.id}`,
          href: headingHref(basePath, chapter.slug, passage.heading.id),
          kind: 'passage' as const,
          label: passage.heading.text,
          snippet: passage.snippet,
        })),
      ];
    });
  }, [outcome, basePath]);

  // The word still being typed, and what the book suggests it becomes (N17).
  const completion = useMemo(() => {
    if (!index || /\s$/.test(query)) return undefined;
    const last = tokenize(query).pop();
    return last ? completeTerm(index, last) : undefined;
  }, [index, query]);

  // A stale selection from a previous query would point at a different row.
  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    if (!open) return;

    // Remembered before the input takes focus, so closing returns the reader
    // to whatever they were on rather than to the top of the document.
    restoreFocusTo.current = document.activeElement;
    inputRef.current?.focus();
    inputRef.current?.select();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      // `preventScroll`, because `focus()` scrolls the element into view and
      // the whole promise of the overlay is that closing it costs the reader
      // nothing. Without it the page lands near the restored element instead of
      // where it was, intermittently — depending on whether that element
      // happened to still be on screen.
      (restoreFocusTo.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelectorAll('li')[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  function go(position: number) {
    const row = rows[position];
    if (!row) return;
    onClose();
    window.location.hash = row.href.slice(1);
  }

  function accept() {
    if (!completion) return;
    // Only the word being typed is replaced; whitespace runs are preserved by
    // splitting on a capturing separator.
    const parts = query.split(/(\s+)/);
    parts[parts.length - 1] = completion;
    setQuery(parts.join(''));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    // Tab completes only when there is something to complete; otherwise it
    // stays the key that moves focus, which inside a dialog still matters.
    if (event.key === 'Tab' && completion && !event.shiftKey) {
      event.preventDefault();
      accept();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((position) => Math.min(position + 1, rows.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((position) => Math.max(position - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(selected);
    }
  }

  const terms = outcome?.terms ?? [];
  const passageCount = outcome?.passageCount ?? 0;
  const chapterCount = outcome?.chapters.length ?? 0;

  return (
    // The handler is on the container so it catches keys from the input and
    // from a focused result alike; the dialog inside is what is announced.
    <div className="search-overlay" onKeyDown={onKeyDown}>
      <div
        className="search-overlay__scrim"
        aria-hidden="true"
        onClick={onClose}
        data-testid="search-scrim"
      />
      <div
        className="search-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Search ${book.meta.title}`}
      >
        <div className="search-overlay__field">
          <label htmlFor="book-search" className="visually-hidden">
            Search this book
          </label>
          <input
            ref={inputRef}
            id="book-search"
            type="search"
            placeholder="Search this book…"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // The list is not focusable; the input keeps focus and announces
            // which row the arrow keys are on.
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="search-results"
            aria-activedescendant={rows.length > 0 ? `search-result-${selected}` : undefined}
          />
          <button type="button" className="search-overlay__close" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Passages *and* chapters, because "9 passages in 2 chapters" tells
            the reader something "2 results" does not (N12). */}
        <p className="search-overlay__meta" role="status">
          {query.trim() === '' ? (
            'Type to search this book.'
          ) : passageCount === 0 ? (
            'No matches.'
          ) : (
            <>
              {passageCount} matching {passageCount === 1 ? 'passage' : 'passages'} in{' '}
              {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'}
              {completion && (
                <>
                  {' · '}
                  <button type="button" className="search-overlay__complete" onClick={accept}>
                    <kbd>Tab</kbd> {completion}
                  </button>
                </>
              )}
            </>
          )}
        </p>

        <ul className="search-overlay__list" id="search-results" role="listbox" ref={listRef}>
          {rows.map((row, position) => (
            <li
              key={row.key}
              id={`search-result-${position}`}
              role="option"
              aria-selected={position === selected}
              className={[
                `search-overlay__row--${row.kind}`,
                position === selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <a href={row.href} onClick={onClose} onMouseEnter={() => setSelected(position)}>
                {row.kind === 'chapter' ? (
                  <strong>{mark(row.label, terms)}</strong>
                ) : (
                  <span className="search-overlay__section">{mark(row.label, terms)}</span>
                )}
                {row.snippet && (
                  <span className="search-overlay__snippet">{mark(row.snippet, terms)}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The terms, marked in place — built as elements, never as an HTML string. */
function mark(text: string, terms: string[]) {
  return highlight(text, terms).map((part, index) =>
    part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
  );
}
