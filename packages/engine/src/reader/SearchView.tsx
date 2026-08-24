import { useMemo } from 'react';
import type { Book } from '../types';
import { searchChapters } from './search';

interface SearchViewProps {
  book: Book;
  basePath: string;
  query: string;
}

export function SearchView({ book, basePath, query }: SearchViewProps) {
  const results = useMemo(() => searchChapters(book.chapters, query), [book.chapters, query]);

  return (
    <section className="search-view" aria-label="Search results">
      <h1>Search{query ? `: “${query}”` : ''}</h1>
      {query && results.length === 0 && <p>No results found.</p>}
      {!query && <p>Type a term in the search box to find content across this book.</p>}
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
