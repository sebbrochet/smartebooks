import { useEffect, useState } from 'react';
import type { Heading } from '../markdown/headings';
import { activeHeading } from './activeHeading';
import { scrollportOf, isDocumentScrollport, scrollportTop, isScrolledToEnd } from './scrollport';

/** How far down the viewport a heading must pass to count as "being read". */
const THRESHOLD = 96;

export interface ReadingSpot {
  /** The section being read, or undefined above the first heading. */
  sectionId?: string;
  /**
   * Pixels this section has scrolled past the top of **whatever scrolls it** —
   * the page, or the pane it sits in (SPEC008 G9.5). Identical for the page,
   * because a page's scrollport top is zero.
   */
  offset?: number;
}

/**
 * Where in the chapter the reader is, as a heading plus a distance from it.
 *
 * One measurement with two customers: the contents rail marks this entry, and
 * the shell saves it so the next visit resumes here (SPEC002 N3, S4). They used
 * to be separate concerns and the rail owned the only implementation, which
 * meant "the section shown as active" and "the section we would resume to"
 * could in principle disagree — a difference no test would ever have caught,
 * because nothing compared them.
 *
 * An anchor and an offset rather than a scroll position, because a pixel count
 * stops meaning anything as soon as the layout reflows.
 */
export function useActiveSection(headings: Heading[]): ReadingSpot {
  const [spot, setSpot] = useState<ReadingSpot>({ offset: 0 });

  useEffect(() => {
    setSpot({ offset: 0 });

    // Coalesced into a frame: scroll fires far more often than the answer can
    // change, and this measures every heading.
    let queued = false;
    function measure() {
      queued = false;

      const positions = headings
        .map((heading) => document.getElementById(heading.id))
        .filter((element): element is HTMLElement => element !== null)
        .map((element) => ({
          id: element.id,
          top: element.getBoundingClientRect().top,
          element,
        }));

      // 2px of slack: fractional zoom and sub-pixel layout mean this arithmetic
      // rarely lands exactly on the document height.
      //
      // Asked of whatever scrolls the headings, not of the page. A chapter in a
      // pane leaves the document permanently at its end, which would pin the
      // active section to the last heading for the whole chapter and resume the
      // reader there (SPEC008 G9.5). Empty means no section anyway, so the
      // question is only worth asking when there is something to ask it about.
      const atBottom = positions.length > 0 && isScrolledToEnd(scrollportOf(positions[0].element));
      const sectionId = activeHeading(positions, THRESHOLD, atBottom);

      const found = sectionId ? positions.find((p) => p.id === sectionId) : undefined;
      if (!found) {
        setSpot({ sectionId, offset: Math.round(window.scrollY) });
        return;
      }

      // Measured from the top of the scrollport rather than the viewport, so a
      // section inside a pane records how far *it* has scrolled rather than
      // where the pane happens to sit on screen (SPEC008 G9.5).
      const port = scrollportOf(found.element);
      setSpot({ sectionId, offset: Math.round(scrollportTop(port) - found.top) });
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    }

    measure();
    /*
     * **Capture phase, on the document.** Scroll events do not bubble, so a
     * listener on `window` never hears a pane scroll — measured at zero of
     * them while the chess score moved 120px. They do *capture*, so one
     * listener catches the page and every pane in it, without hunting for
     * scrollports or registering per element.
     */
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  return spot;
}

/**
 * Scrolls to a remembered spot, if it can still be found.
 *
 * Returns whether it succeeded, so the caller can fall back to the top rather
 * than leaving the reader wherever the browser happened to be. A section that
 * no longer exists — the book was corrected, the chapter rewritten — is a miss,
 * not an error: the reader gets the chapter, which is what they had before.
 */
export function scrollToSpot(spot: ReadingSpot): boolean {
  if (!spot.sectionId) {
    if (!spot.offset) return false;
    window.scrollTo(0, spot.offset);
    return true;
  }

  const heading = document.getElementById(spot.sectionId);
  if (!heading) return false;

  /*
   * Scroll whatever scrolls this heading. `window.scrollTo` cannot move a
   * heading that lives in a pane — the window is already where it needs to be,
   * and the reader would simply not arrive (SPEC008 G9.5).
   */
  const port = scrollportOf(heading);
  const distance = heading.getBoundingClientRect().top - scrollportTop(port) + (spot.offset ?? 0);

  if (isDocumentScrollport(port)) window.scrollBy(0, distance);
  else port.scrollTop += distance;

  return true;
}
