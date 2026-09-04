import { describe, it, expect } from 'vitest';
import { islandIds, bookIslandIds } from './islandIds';

describe('islandIds', () => {
  it('finds ids on block, leaf and inline directives alike', () => {
    const markdown = [
      '# Chapter',
      '',
      ':::quiz{id="q-1"}',
      '### Q?',
      '',
      '- [x] Yes',
      ':::',
      '',
      '::video{id="v-1" src="https://example.com/a.mp4"}',
      '',
      'A :term[palimpsest]{id="t-1" definition="Scraped."} page.',
      '',
    ].join('\n');

    expect(islandIds(markdown).sort()).toEqual(['q-1', 't-1', 'v-1']);
  });

  /**
   * The registry is deliberately not consulted: a book may use a pack this
   * reader does not have, and those ids are still the author's and are still
   * addressed by keys sitting in the store.
   */
  it('does not care whether the island is one this reader knows', () => {
    expect(islandIds(':::not-a-real-island{id="x-1"}\n:::\n')).toEqual(['x-1']);
  });

  it('ignores directives with no id, and prose that merely looks like one', () => {
    const markdown = ':::quiz\n### Q?\n:::\n\nThe attribute `id="not-a-directive"` in text.\n';
    expect(islandIds(markdown)).toEqual([]);
  });

  it('reports each id once, however often it appears', () => {
    expect(islandIds('::video{id="v" src="a"}\n\n::video{id="v" src="b"}\n')).toEqual(['v']);
  });
});

describe('bookIslandIds', () => {
  it('gathers every chapter’s ids into one set', () => {
    const ids = bookIslandIds({
      'content/01.md': ':::quiz{id="q-1"}\n:::\n',
      'content/02.md': ':::quiz{id="q-2"}\n:::\n',
    });

    expect([...ids].sort()).toEqual(['q-1', 'q-2']);
  });

  it('is empty for a book that asks nothing', () => {
    expect(bookIslandIds({ 'content/01.md': '# Just prose\n' }).size).toBe(0);
  });
});
