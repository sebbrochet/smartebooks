import { useEffect, useRef, useState } from 'react';
import type { Heading } from '../markdown/headings';
import { useMediaQuery, NARROW } from './useMediaQuery';
import { keepInView } from './keepInView';

interface TableOfContentsProps {
  headings: Heading[];
  /** Builds the href for a heading id — the caller owns the route. */
  linkTo: (id: string) => string;
  /**
   * The section being read, measured by the shell.
   *
   * Supplied rather than measured here because the shell needs the same answer
   * to remember where the reader was; two measurements could disagree, and
   * nothing would compare them.
   */
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
  const narrow = useMediaQuery(NARROW);
  const [openOnPhone, setOpenOnPhone] = useState(false);
  const railRef = useRef<HTMLElement>(null);

  // On a phone the rail sits above the chapter, so an open list of seven
  // sections is seven links between the reader and the first sentence — the
  // same wall the chapter drawer was built to remove, one level down. Measured
  // at 420×780: it pushed the chapter title to y=632 and the first sentence off
  // the screen entirely (SPEC002 N6).
  const listVisible = !narrow || openOnPhone;
  const current = activeId;

  // Keep the active entry inside the rail's own scrollport. A rail long enough
  // to need this is exactly a rail whose active entry would otherwise sit past
  // its bottom edge, tracking a section the reader cannot see it tracking.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !current) return;

    const link = rail.querySelector<HTMLElement>(`[data-heading="${CSS.escape(current)}"]`);
    if (!link) return;

    /*
     * Against the **`nav`**, which is the element carrying `max-height` and
     * `overflow-y`. An earlier version scrolled the `ul` and did nothing at
     * all: an unclipped list has `scrollTop === 0` and a `clientHeight` equal
     * to its full height, so every entry looked like it was already in view.
     * Nothing smaller than a 60-section chapter could show the difference.
     */
    keepInView(rail, link);
  }, [current]);

  if (headings.length < 2) return null;

  return (
    <nav className="toc" aria-labelledby="toc-title" ref={railRef}>
      {narrow ? (
        <h2 className="toc__title" id="toc-title">
          <button
            type="button"
            className="toc__toggle"
            aria-expanded={openOnPhone}
            aria-controls="toc-list"
            onClick={() => setOpenOnPhone((previous) => !previous)}
          >
            <span className="toc__marker" aria-hidden="true" />
            On this page
          </button>
        </h2>
      ) : (
        <h2 className="toc__title" id="toc-title">
          On this page
        </h2>
      )}
      <ul className="toc__list" id="toc-list" hidden={!listVisible}>
        {headings.map((heading) => (
          <li key={heading.id} className={`toc__item toc__item--h${heading.depth}`}>
            <a
              href={linkTo(heading.id)}
              data-heading={heading.id}
              className={heading.id === current ? 'is-active' : undefined}
              aria-current={heading.id === current ? 'true' : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
