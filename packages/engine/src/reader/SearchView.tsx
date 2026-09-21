import { useMemo } from 'react';
import type { Book } from '../types';
import { useMessages } from '../i18n/messages';
import { searchChapters } from './search';

interface SearchViewProps {
  book: Book;
  basePath: string;
  query: string;
}

export function SearchView({ book, basePath, query }: SearchViewProps) {
  const results = useMemo(() => searchChapters(book.chapters, query), [book.chapters, query]);
  const words = useMessages();

  return (
    <section className="search-view" aria-label={words.searchResults}>
      <h1>{words.searchHeading(query)}</h1>
      {query && results.length === 0 && <p>{words.searchViewEmpty}</p>}
      {!query && <p>{words.searchViewHint}</p>}
      <ul className="search-view__list">
        {results.map((result) => (
          <li key={result.slug}>
            <a href={`#${basePath}/${result.slug}`}>
              <strong>{result.title}</strong>
            </a>
            <p className="search-view__snippet">{result.snippet}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
