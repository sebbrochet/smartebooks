// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scrollToSpot } from './useActiveSection';

/**
 * SPEC008 G9.5 — resume must follow the pane.
 *
 * The saved place is a heading plus an offset (SPEC002 S4). Restoring it used
 * to be one `window.scrollTo`, which is correct exactly while the chapter is a
 * single document. A heading inside a pane cannot be reached that way: the
 * window is already where it needs to be, so the call succeeds, reports
 * success, and moves nothing.
 *
 * jsdom does no layout, so both the rectangles and the scroll positions are
 * stated rather than measured. What is being tested is the arithmetic and
 * *which element it is applied to* — the part that was wrong.
 */

/** jsdom's `scrollTop` is a fixed 0; make it a real, writable number. */
function makeScrollable(el: HTMLElement): void {
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true });
}

function at(el: Element, top: number): void {
  el.getBoundingClientRect = () => ({ top, bottom: top + 24, height: 24 }) as DOMRect;
}

/**
 * A window that remembers where it was scrolled to.
 *
 * jsdom's `scrollTo`/`scrollBy` are inert, so the assertions here would
 * otherwise have to name the API being called — which would make this a test of
 * the implementation rather than of where the reader ends up. Both are modelled,
 * so the page case passes for any correct way of writing it and the pane case is
 * the only thing that carries the change.
 */
function fakeWindowScroll(): { moved: () => boolean } {
  let moved = false;
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  window.scrollTo = ((_x: number, y: number) => {
    moved = true;
    (window as { scrollY: number }).scrollY = y;
  }) as typeof window.scrollTo;
  window.scrollBy = ((_x: number, y: number) => {
    moved = true;
    (window as { scrollY: number }).scrollY += y;
  }) as typeof window.scrollBy;
  return { moved: () => moved };
}

let page: { moved: () => boolean };

beforeEach(() => {
  page = fakeWindowScroll();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('scrollToSpot', () => {
  it('scrolls the page when the heading is in the page', () => {
    document.body.innerHTML = '<article><h2 id="s">S</h2></article>';
    at(document.getElementById('s')!, 500);

    expect(scrollToSpot({ sectionId: 's', offset: 120 })).toBe(true);
    // 500px below the fold, and the reader was 120px past the heading.
    expect(window.scrollY).toBe(620);
  });

  it('scrolls the pane, not the page, when the heading is in a pane', () => {
    document.body.innerHTML = `
      <div id="pane" style="overflow-y: auto">
        <article><h2 id="s">S</h2></article>
      </div>
    `;
    const pane = document.getElementById('pane')!;
    makeScrollable(pane);
    at(pane, 100);
    at(document.getElementById('s')!, 500);

    expect(scrollToSpot({ sectionId: 's', offset: 120 })).toBe(true);

    // 400px below the pane's own top edge, plus the reader's 120px.
    expect(pane.scrollTop).toBe(520);
    // And the page must not move: the pane is already on screen.
    expect(page.moved()).toBe(false);
  });

  it('measures the offset from where the pane has already scrolled to', () => {
    document.body.innerHTML = `
      <div id="pane" style="overflow-y: auto">
        <article><h2 id="s">S</h2></article>
      </div>
    `;
    const pane = document.getElementById('pane')!;
    makeScrollable(pane);
    pane.scrollTop = 300;
    at(pane, 100);
    // Already scrolled 300px, so the heading now sits 40px above the pane top.
    at(document.getElementById('s')!, 60);

    scrollToSpot({ sectionId: 's', offset: 120 });

    // 300 - 40 + 120: the heading ends up 120px above the top of the pane.
    expect(pane.scrollTop).toBe(380);
  });

  it('reports a miss when the section no longer exists', () => {
    document.body.innerHTML = '<article><h2 id="s">S</h2></article>';

    expect(scrollToSpot({ sectionId: 'gone', offset: 120 })).toBe(false);
    expect(page.moved()).toBe(false);
  });
});
