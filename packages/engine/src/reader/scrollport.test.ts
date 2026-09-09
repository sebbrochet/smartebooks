// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest';
import { scrollportOf, isDocumentScrollport, scrollportTop, isScrolledToEnd } from './scrollport';

/**
 * SPEC008 G9.5. Resume is anchored to a heading, and restoring it means
 * scrolling *the thing that scrolls that heading*. While a chapter is one
 * document that is always the window; inside a pane it is not, and a
 * `window.scrollTo` moves nothing.
 */
function build(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no #${id} in the fixture`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('finding the scrollport', () => {
  it('is the document when nothing else scrolls', () => {
    build('<article><h2 id="a">A</h2></article>');

    expect(isDocumentScrollport(scrollportOf(byId('a')))).toBe(true);
  });

  it('is the nearest ancestor that scrolls', () => {
    build(`
      <div id="outer" style="overflow-y: auto">
        <div id="inner" style="overflow-y: scroll">
          <h2 id="a">A</h2>
        </div>
      </div>
    `);

    expect(scrollportOf(byId('a')).id).toBe('inner');
  });

  it('walks past ancestors that do not scroll', () => {
    build(`
      <div id="pane" style="overflow-y: auto">
        <section><div><h2 id="a">A</h2></div></section>
      </div>
    `);

    expect(scrollportOf(byId('a')).id).toBe('pane');
  });

  /*
   * `hidden` is scrollable through `scrollTop`, and is nearly always a clipping
   * wrapper rather than somewhere a reader scrolls. Treating it as the
   * scrollport would move something the reader cannot see themselves moving.
   */
  it('does not treat a clipping wrapper as a scrollport', () => {
    build(`
      <div id="clip" style="overflow: hidden">
        <h2 id="a">A</h2>
      </div>
    `);

    expect(isDocumentScrollport(scrollportOf(byId('a')))).toBe(true);
  });

  it('reports the page top as zero, so the offset means the same in both cases', () => {
    build('<article><h2 id="a">A</h2></article>');

    expect(scrollportTop(scrollportOf(byId('a')))).toBe(0);
  });
});

/*
 * The last heading of a chapter is usually too close to the bottom to reach the
 * "being read" line, so `activeHeading` treats the end of the scroll as "the
 * last section". Asked of the page while the prose is in a pane, that is true
 * from the moment the chapter opens — which would mark the last section active
 * for the whole chapter and resume the reader at the end of it.
 */
describe('the end of a scrollport', () => {
  function pane(sizes: {
    clientHeight: number;
    scrollTop: number;
    scrollHeight: number;
  }): HTMLElement {
    build('<div id="pane" style="overflow-y: auto"><h2 id="a">A</h2></div>');
    const el = byId('pane');
    for (const [name, value] of Object.entries(sizes)) {
      Object.defineProperty(el, name, { value, configurable: true });
    }
    return el;
  }

  it('is not reached merely because the page around it does not scroll', () => {
    const el = pane({ clientHeight: 400, scrollTop: 0, scrollHeight: 2000 });

    // The document *is* at its end — jsdom reports every page dimension as 0 —
    // and the pane is at the top. The pane is the one that must be believed.
    expect(isScrolledToEnd(document.documentElement)).toBe(true);
    expect(isScrolledToEnd(el)).toBe(false);
  });

  it('is reached when the pane itself is scrolled to the bottom', () => {
    const el = pane({ clientHeight: 400, scrollTop: 1600, scrollHeight: 2000 });

    expect(isScrolledToEnd(el)).toBe(true);
  });

  it('allows 2px of slack for sub-pixel layout', () => {
    const el = pane({ clientHeight: 400, scrollTop: 1598.5, scrollHeight: 2000 });

    expect(isScrolledToEnd(el)).toBe(true);
  });
});
