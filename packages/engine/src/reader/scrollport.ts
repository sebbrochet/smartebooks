/**
 * Which element actually scrolls a given node.
 *
 * The reader's saved place is a heading plus an offset (SPEC002 S4), and both
 * halves assumed the window was the only thing that scrolls. That holds while a
 * chapter is one document — and stops holding the moment any content sits in a
 * pane of its own (SPEC008 G9.2), because scrolling a pane moves the window not
 * at all.
 *
 * Measured 2026-09-08, scrolling the chess score by 120px:
 *
 *     window 'scroll' listeners fired : 0
 *     document capture-phase fired    : 1
 *     a page heading's viewport top   : 385.34 -> 385.34
 *
 * The third line is the reassuring one: `getBoundingClientRect()` is relative
 * to the viewport, so a measurement taken after *any* scrollport moves is still
 * correct. Only the questions "did something scroll" and "what do I scroll to
 * get there" need to learn about panes.
 */

/**
 * The nearest ancestor that scrolls `node`, or the document's scrolling element.
 *
 * `auto` and `scroll` only. An `overflow: hidden` ancestor *can* be scrolled
 * programmatically, but it is nearly always a clipping wrapper rather than
 * somewhere a reader scrolls, and moving one would be a surprise the reader did
 * not ask for.
 */
export function scrollportOf(node: Element): Element {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return el;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** Whether this scrollport is the page itself rather than a pane within it. */
export function isDocumentScrollport(port: Element): boolean {
  return port === document.scrollingElement || port === document.documentElement;
}

/**
 * Where the top of the reading area is, in viewport coordinates.
 *
 * Zero for the page, and the pane's own top edge otherwise — which is what
 * makes the saved offset mean the same thing in both cases: *how far this
 * section has scrolled past the top of whatever is scrolling it.*
 */
export function scrollportTop(port: Element): number {
  return isDocumentScrollport(port) ? 0 : port.getBoundingClientRect().top;
}

/**
 * Whether this scrollport has been scrolled to its end.
 *
 * The last section of a chapter is usually shorter than a screen, so its
 * heading can never reach the "being read" line however far the reader
 * scrolls — `activeHeading` needs this to make the final entry reachable at
 * all.
 *
 * Asked of the **page**, that is a question with a useful answer. Asked of the
 * page while the prose lives in a pane, it is not: the document does not
 * scroll, so it is at its end permanently, and every measurement reports the
 * last heading. Resume would then return the reader to the end of the chapter
 * they were halfway through, and the contents rail would mark the wrong entry
 * for the whole chapter (SPEC008 G9.5).
 *
 * 2px of slack, as before: fractional zoom and sub-pixel layout mean this
 * arithmetic rarely lands exactly.
 */
export function isScrolledToEnd(port: Element): boolean {
  if (isDocumentScrollport(port)) {
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
  }
  return port.clientHeight + port.scrollTop >= port.scrollHeight - 2;
}
