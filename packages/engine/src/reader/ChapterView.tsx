import { useMemo } from 'react';
import { renderMarkdown } from '../markdown/render';
import { chapterUnits, headingHref } from '../markdown/headings';
import { UnitProvider } from './BookContext';
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
  /**
   * The unit to deliver, from the route's `?s=`. Only consulted when the book
   * declares a `unitDepth`; otherwise the whole file is the page and `?s=`
   * means "scroll to this heading", which the shell handles.
   */
  section?: string;
}

export function ChapterView({
  book,
  basePath,
  chapter,
  trusted = true,
  resolveAsset,
  registry,
  highlight,
  section,
}: ChapterViewProps) {
  const linkTo = useMemo(
    () => (id: string) => headingHref(basePath, chapter.slug, id),
    [basePath, chapter.slug],
  );

  /*
   * One unit, or the whole file (SPEC005 M2).
   *
   * Delivering one unit is the only thing that actually withholds the others:
   * hiding the links leaves every section in the DOM, where a reader can scroll
   * into the ending and Ctrl+F finds it (SPEC011 B2).
   *
   * A unit the book does not have falls back to the first rather than to a
   * blank page — an unreadable `?s=` should cost the reader their place, not
   * the chapter. Which unit a reader may *have* is a separate question, and the
   * book's to answer (SPEC002 R1.1a).
   */
  const delivered = useMemo(() => {
    const depth = book.descriptor.unitDepth;
    if (!depth) return undefined;

    const { units } = chapterUnits(chapter.markdown, depth);
    if (units.length === 0) return undefined;

    return units.find((unit) => unit.id === section) ?? units[0];
  }, [book.descriptor.unitDepth, chapter.markdown, section]);

  const content = useMemo(
    () =>
      renderMarkdown(delivered?.markdown ?? chapter.markdown, {
        trusted,
        resolveAsset,
        registry,
        headingLink: linkTo,
        highlightTerms: highlight,
      }),
    [delivered, chapter.markdown, trusted, resolveAsset, registry, linkTo, highlight],
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
        <UnitProvider unit={delivered?.id}>{content}</UnitProvider>
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
