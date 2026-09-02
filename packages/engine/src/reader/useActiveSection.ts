import { useEffect, useState } from 'react';
import type { Heading } from '../markdown/headings';
import { activeHeading } from './activeHeading';

/** How far down the viewport a heading must pass to count as "being read". */
const THRESHOLD = 96;

export interface ReadingSpot {
  /** The section being read, or undefined above the first heading. */
  sectionId?: string;
  /** Pixels below that heading — or below the top of the page when there is none. */
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
        .map((element) => ({ id: element.id, top: element.getBoundingClientRect().top }));

      // 2px of slack: fractional zoom and sub-pixel layout mean this arithmetic
      // rarely lands exactly on the document height.
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      const sectionId = activeHeading(positions, THRESHOLD, atBottom);

      const top = sectionId ? positions.find((p) => p.id === sectionId)?.top : undefined;
      setSpot({ sectionId, offset: Math.round(top === undefined ? window.scrollY : -top) });
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

  window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY + (spot.offset ?? 0));
  return true;
}
