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
}

export function ChapterView({
  book,
  basePath,
  chapter,
  trusted = true,
  resolveAsset,
  registry,
}: ChapterViewProps) {
  const linkTo = useMemo(
    () => (id: string) => headingHref(basePath, chapter.slug, id),
    [basePath, chapter.slug],
  );

  const content = useMemo(
    () =>
      renderMarkdown(chapter.markdown, { trusted, resolveAsset, registry, headingLink: linkTo }),
    [chapter.markdown, trusted, resolveAsset, registry, linkTo],
  );

  const index = book.chapters.findIndex((c) => c.slug === chapter.slug);
  const prev = book.chapters[index - 1];
  const next = book.chapters[index + 1];

  return (
    <>
      <article className="prose">{content}</article>
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
