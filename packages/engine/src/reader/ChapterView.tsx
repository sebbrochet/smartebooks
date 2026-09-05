import { useMemo } from 'react';
import { renderMarkdown } from '../markdown/render';
import { headingHref } from '../markdown/headings';
import type { Book, Chapter } from '../types';
import type { IslandRegistry } from '../islandRegistry';

interface ChapterViewProps {
  book: Book;
  basePath: string;
  chapter: Chapter;
  trusted?: boolean;
  resolveAsset?: (src: string) => string | undefined;
  registry: IslandRegistry;
  /** Terms to mark in the prose, when the reader arrived from a search. */
  highlight?: string[];
}

export function ChapterView({
  book,
  basePath,
  chapter,
  trusted = true,
  resolveAsset,
  registry,
  highlight,
}: ChapterViewProps) {
  const linkTo = useMemo(
    () => (id: string) => headingHref(basePath, chapter.slug, id),
    [basePath, chapter.slug],
  );

  const content = useMemo(
    () =>
      renderMarkdown(chapter.markdown, {
        trusted,
        resolveAsset,
        registry,
        headingLink: linkTo,
        highlightTerms: highlight,
      }),
    [chapter.markdown, trusted, resolveAsset, registry, linkTo, highlight],
  );

  const index = book.chapters.findIndex((c) => c.slug === chapter.slug);
  const prev = book.chapters[index - 1];
  const next = book.chapters[index + 1];

  return (
    <>
      {/*
       * `lang` sits on the prose, not on the document (SPEC010 M1).
       *
       * The shell's own language is not the book's, and the two are visible at
       * once — a French novel is read through English controls, and the shelf
       * behind it lists books in several languages. Marking the document would
       * have to keep changing and would be wrong for whatever it is not
       * currently describing; marking the prose is true wherever the reader
       * looks.
       *
       * It is also the attribute that does the work. Hyphenation follows the
       * nearest `lang`, and so does the voice a screen reader reads in, so this
       * is the element that needs it.
       */}
      <article className="prose" lang={book.meta.language}>
        {content}
      </article>
      <nav className="chapter-nav" aria-label="Chapter navigation">
        {prev ? (
          <a className="chapter-nav__prev" href={`#${basePath}/${prev.slug}`}>
            <span aria-hidden="true">←</span> {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a className="chapter-nav__next" href={`#${basePath}/${next.slug}`}>
            {next.title} <span aria-hidden="true">→</span>
          </a>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
