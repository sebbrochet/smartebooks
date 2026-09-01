import { useState, type FormEvent } from 'react';
import type { Book } from '../types';
import { navSections } from './navSections';

interface SidebarProps {
  book: Book;
  basePath: string;
  view: 'chapter' | 'search';
  activeSlug?: string;
  query?: string;
}

export function Sidebar({ book, basePath, view, activeSlug, query }: SidebarProps) {
  const [text, setText] = useState(view === 'search' ? (query ?? '') : '');
  const currentSlug = view === 'chapter' ? (activeSlug ?? book.chapters[0]?.slug) : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    window.location.hash = trimmed
      ? `${basePath}/search?q=${encodeURIComponent(trimmed)}`
      : basePath;
  }

  return (
    <nav className="sidebar" aria-label="Book navigation">
      <form className="sidebar__search" role="search" onSubmit={submit}>
        <label htmlFor="book-search" className="visually-hidden">
          Search the book
        </label>
        <input
          id="book-search"
          type="search"
          placeholder="Search…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </form>
      <ul className="sidebar__list">
        {navSections(book.chapters, book.descriptor.parts).map((section, index) => {
          const links = section.chapters.map((chapter) => {
            const active = currentSlug === chapter.slug;
            return (
              <li key={chapter.slug}>
                <a
                  href={`#${basePath}/${chapter.slug}`}
                  className={active ? 'is-active' : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  {chapter.title}
                </a>
              </li>
            );
          });

          // A loose run is spliced straight into the list, so a book with no
          // parts renders exactly the markup it always did.
          if (!section.title) return links;

          // A nested list, not a flat one with headings between: a screen
          // reader should be able to say "Part I, list of six" and skip it.
          return (
            <li key={section.id ?? `loose-${index}`} className="sidebar__part">
              <h3 className="sidebar__part-title" id={`part-${section.id}`}>
                {section.title}
              </h3>
              <ul className="sidebar__list" aria-labelledby={`part-${section.id}`}>
                {links}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
