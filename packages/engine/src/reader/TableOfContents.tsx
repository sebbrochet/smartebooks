import { useEffect, useRef, useState } from 'react';
import type { Heading } from '../markdown/headings';
import { activeHeading } from './activeHeading';

interface TableOfContentsProps {
  headings: Heading[];
  /** Builds the href for a heading id — the caller owns the route. */
  linkTo: (id: string) => string;
  /** The heading the reader arrived at, if any. Used until they scroll. */
  activeId?: string;
}

/** How far down the viewport a heading must pass to count as "being read". */
const THRESHOLD = 96;

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
  const [readingId, setReadingId] = useState<string | undefined>();
  const listRef = useRef<HTMLUListElement>(null);

  // The URL only says where the reader *arrived*. It is wrong the moment they
  // scroll, and absent entirely for anyone who opened the chapter normally.
  const current = readingId ?? activeId;

  useEffect(() => {
    setReadingId(undefined);

    // Coalesced into a frame: scroll fires far more often than the answer can
    // change, and this measures every heading.
    let queued = false;
    function measure() {
      queued = false;
      const offsets = headings
        .map((heading) => document.getElementById(heading.id))
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => ({ id: el.id, top: el.getBoundingClientRect().top }));

      // 2px of slack: fractional zoom and sub-pixel layout mean this arithmetic
      // rarely lands exactly on the document height.
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      setReadingId(activeHeading(offsets, THRESHOLD, atBottom));
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  // Keep the active entry inside the rail's own scrollport. A rail long enough
  // to need this is exactly a rail whose active entry would otherwise sit past
  // its bottom edge, tracking a section the reader cannot see it tracking.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !current) return;

    const link = list.querySelector<HTMLElement>(`[data-heading="${CSS.escape(current)}"]`);
    if (!link) return;

    // Deliberately *not* `scrollIntoView`: the rail is sticky inside a page
    // that also scrolls, and that would drag the reader away from the text.
    const above = link.offsetTop - list.scrollTop;
    const below = above + link.offsetHeight - list.clientHeight;
    if (above < 0) list.scrollTop += above;
    else if (below > 0) list.scrollTop += below;
  }, [current]);

  if (headings.length < 2) return null;

  return (
    <nav className="toc" aria-labelledby="toc-title">
      <h2 className="toc__title" id="toc-title">
        On this page
      </h2>
      <ul className="toc__list" ref={listRef}>
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
