import { useEffect, useState } from 'react';

/**
 * The one narrow-screen breakpoint, shared by every component that has to know
 * about it. **Must match the `max-width: 720px` block in the stylesheet.**
 *
 * Phrased as "narrow" rather than "wide" on purpose: an environment that cannot
 * evaluate media queries answers `false`, and "not narrow" is the safe reading.
 * A control that only exists on a phone is then simply absent, rather than a
 * list being folded away by a query nobody could evaluate.
 */
export const NARROW = '(max-width: 720px)';

/**
 * Whether a CSS media query currently matches, as React state.
 *
 * For the cases where a breakpoint changes *structure* rather than appearance:
 * a control that only exists on a narrow screen, or a list that has to be
 * foldable there and always open elsewhere. Those cannot be expressed in CSS
 * alone without lying to assistive technology — an `aria-expanded="false"` on a
 * list that a media query has quietly made visible is worse than no control.
 *
 * Anything purely visual belongs in the stylesheet instead. The cost here is a
 * breakpoint written down twice, and that is only worth paying when the markup
 * itself differs.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => supported() && window.matchMedia(query).matches);

  useEffect(() => {
    if (!supported()) return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);

    // Re-read on subscribe: the query can have changed between the initial
    // state and this effect running.
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Environments without a layout engine — a jsdom test, or server rendering. */
function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}
