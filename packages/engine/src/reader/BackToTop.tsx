import { useEffect, useState, type RefObject } from 'react';

interface BackToTopProps {
  /** Focus moves here on activation, so the keyboard follows the scroll. */
  target: RefObject<HTMLElement | null>;
  /** How far down the page the button becomes useful, in pixels. */
  threshold?: number;
}

/**
 * A way back to the top of a long chapter.
 *
 * Hidden until the reader is far enough down that scrolling back is a chore —
 * a button that is always there is one more thing overlapping the text for no
 * benefit on a short page.
 *
 * Scrolling alone would strand a keyboard reader: the viewport moves and the
 * focus does not, so the next Tab continues from wherever they were, near the
 * bottom. Focus moves to the reading column too.
 */
export function BackToTop({ target, threshold = 600 }: BackToTopProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Coalesced into a frame: scroll fires far more often than the answer to
    // "is it past the threshold" can change.
    let queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setShown(window.scrollY > threshold);
      });
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  function toTop() {
    // `preventScroll`, and focus first. Focusing an element scrolls it into
    // view, and that scroll cancels a smooth one already in flight: without
    // this the page settles wherever the reader happened to be. Measured at
    // 2351px instead of 0 in the Playwright run that caught it.
    target.current?.focus({ preventScroll: true });

    const gentle = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: gentle ? 'smooth' : 'auto' });
  }

  return (
    <button
      type="button"
      className={shown ? 'back-to-top is-shown' : 'back-to-top'}
      onClick={toTop}
      // Removed from the tab order rather than the DOM while it is invisible,
      // so nobody tabs to a control they cannot see.
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
    >
      <span aria-hidden="true">↑</span> Top
    </button>
  );
}
