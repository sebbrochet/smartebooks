import type { Heading } from '../markdown/headings';

interface TableOfContentsProps {
  headings: Heading[];
  /** Builds the href for a heading id — the caller owns the route. */
  linkTo: (id: string) => string;
  /** The heading currently addressed, if the reader arrived at one. */
  activeId?: string;
}

/**
 * "On this page": the sections of the current chapter.
 *
 * A chapter was previously one indivisible thing — you could see its title in
 * the sidebar and nothing about its shape until you scrolled it (SPEC002 S3).
 *
 * Renders **nothing** for a chapter with fewer than two sections. One entry is
 * not a contents list, it is a restatement of the title, and an empty box of
 * furniture is worse than no box.
 */
export function TableOfContents({ headings, linkTo, activeId }: TableOfContentsProps) {
  if (headings.length < 2) return null;

  return (
    <nav className="toc" aria-labelledby="toc-title">
      <h2 className="toc__title" id="toc-title">
        On this page
      </h2>
      <ul className="toc__list">
        {headings.map((heading) => (
          <li key={heading.id} className={`toc__item toc__item--h${heading.depth}`}>
            <a
              href={linkTo(heading.id)}
              className={heading.id === activeId ? 'is-active' : undefined}
              aria-current={heading.id === activeId ? 'true' : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
