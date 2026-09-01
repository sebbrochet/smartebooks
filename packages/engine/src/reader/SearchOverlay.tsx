import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../types';
import { buildCorpus, searchCorpus, highlight } from './search';

interface SearchOverlayProps {
  book: Book;
  basePath: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Search, as something that happens *over* the book rather than instead of it.
 *
 * It used to be a route: typing a query navigated to `#/<book>/search?q=…`,
 * which replaced the chapter, discarded the scroll position, and made "I only
 * wanted to check a word" cost the reader their place (SPEC002 N8). An overlay
 * closes back onto the exact same pixel.
 *
 * Results update per keystroke rather than on `Enter` (N9), which is only
 * affordable because the book's text is now parsed once into a corpus instead
 * of per query.
 */
export function SearchOverlay({ book, basePath, open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  const corpus = useMemo(() => buildCorpus(book.chapters), [book.chapters]);
  const results = useMemo(() => searchCorpus(corpus, query), [corpus, query]);

  // A stale selection from a previous query would point at a different result.
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

  // Keep the highlighted result in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelectorAll('li')[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  function go(index: number) {
    const result = results[index];
    if (!result) return;
    onClose();
    window.location.hash = `${basePath}/${result.slug}`;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(selected);
    }
  }

  const terms = results[0]?.terms ?? [];

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
            // which result the arrow keys are on.
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results.length > 0 ? `search-result-${selected}` : undefined}
          />
          <button type="button" className="search-overlay__close" onClick={onClose}>
            Close
          </button>
        </div>

        {/* A count, so "no results" and "one very good result" are told apart
            at a glance rather than by counting rows (N12). */}
        <p className="search-overlay__meta" role="status">
          {query.trim() === ''
            ? 'Type to search this book.'
            : results.length === 0
              ? 'No matching chapters.'
              : `${results.length} matching ${results.length === 1 ? 'chapter' : 'chapters'}`}
        </p>

        <ul className="search-overlay__list" id="search-results" role="listbox" ref={listRef}>
          {results.map((result, index) => (
            <li
              key={result.slug}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === selected}
              className={index === selected ? 'is-selected' : undefined}
            >
              <a
                href={`#${basePath}/${result.slug}`}
                onClick={onClose}
                onMouseEnter={() => setSelected(index)}
              >
                <strong>{mark(result.title, terms)}</strong>
                <span className="search-overlay__snippet">{mark(result.snippet, terms)}</span>
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
