import { useState, type FormEvent } from 'react';
import type { Book } from '../types';

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
        {book.chapters.map((chapter) => {
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
        })}
      </ul>
    </nav>
  );
}
