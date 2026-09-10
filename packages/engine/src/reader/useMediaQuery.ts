import { useEffect, useState } from 'react';

/**
 * The one narrow-screen breakpoint, shared by every component that has to know
 * about it. **Must match the matching block in the stylesheet** — the e2e test
 * "the breakpoint means the same thing to the stylesheet and to the script"
 * fails when they drift.
 *
 * Two clauses because the thing being asked is "is this a phone", and a phone
 * turned on its side is 844px wide. Width alone answered no, and the reader got
 * the desk layout on a 390px-tall screen: the rail unfolded into the row above
 * the chapter and the sidebar left its drawer, between them taking every line
 * of prose off the first screen (SPEC009 V15). Height is the axis that a phone
 * on its side actually runs out of, so it is the axis that has to be asked
 * about. 600px sits in open country — phones are 320–430 tall in landscape,
 * tablets 744 and up.
 *
 * Phrased as "narrow" rather than "wide" on purpose: an environment that cannot
 * evaluate media queries answers `false`, and "not narrow" is the safe reading.
 * A control that only exists on a phone is then simply absent, rather than a
 * list being folded away by a query nobody could evaluate.
 */
export const NARROW = '(max-width: 720px), (max-height: 600px)';

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
