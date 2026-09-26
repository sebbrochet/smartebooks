import { describe, it, expect } from 'vitest';
import { musicIslands, DEFAULT_WIDTH } from './index';

const island = () => musicIslands()[0];
const ctx = (caption = '') => ({ attributes: { caption } }) as never;

describe('musicIslands', () => {
  it('provides music-figure, under its canonical name and its alias', () => {
    expect(island().name).toBe('music-figure');
    expect(island().aliases).toContain('musicfigure');
  });

  it('takes the book default width, and lets a directive override it', () => {
    expect(musicIslands()[0].attributes?.width).toEqual({
      type: 'number',
      default: DEFAULT_WIDTH,
    });
    expect(musicIslands({ width: 300 })[0].attributes?.width).toEqual({
      type: 'number',
      default: 300,
    });
  });

  // A book that asks for nonsense gets the default rather than an unreadable
  // stave: the runtime is forgiving and `lint:content` is where it is caught.
  it('ignores a width that could not draw anything', () => {
    expect(musicIslands({ width: 0 })[0].attributes?.width).toEqual({
      type: 'number',
      default: DEFAULT_WIDTH,
    });
  });

  // An imported book's descriptor is untrusted, and `islandPacks.ts` puts the
  // duty to check on the pack rather than on the caller. An allow-list, so a
  // value nobody wrote still lands on a vocabulary that exists.
  it('takes noteNames only from the two it knows', () => {
    const piece = (options?: Parameters<typeof musicIslands>[0]) =>
      musicIslands(options).find((definition) => definition.name === 'music-piece');
    const declared = (options?: Parameters<typeof musicIslands>[0]) =>
      (piece(options)?.extract?.({ children: [] } as never) as { noteNames?: string })?.noteNames;

    expect(declared()).toBe('letters');
    expect(declared({ noteNames: 'solfege' })).toBe('solfege');
    expect(declared({ noteNames: 'Solfège' } as never)).toBe('letters');
    expect(declared({ noteNames: '__proto__' } as never)).toBe('letters');
  });
});

/**
 * SPEC017 §4.4. Nothing draws notes without JavaScript, so the static form is
 * the ABC source and the caption — the same answer `mermaid` gives, and for the
 * same reason. It identifies the example rather than replacing it.
 */
describe('the static form', () => {
  it('keeps the source as a fenced abc block', () => {
    expect(island().fallback?.({} as never, { abc: 'CDEF|' }, ctx())).toEqual([
      { type: 'code', lang: 'abc', value: 'CDEF|' },
    ]);
  });

  it('puts the caption first, because it is worth more than the source', () => {
    const nodes = island().fallback?.({} as never, { abc: 'CDEF|' }, ctx('The C major scale'));
    expect(nodes?.[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'emphasis', children: [{ type: 'text', value: 'The C major scale' }] }],
    });
    expect(nodes).toHaveLength(2);
  });

  // A `src=` figure will have an empty body, so the caption is all there is —
  // the weakness SPEC017 §4.4 records for asset-backed examples.
  it('survives on the caption alone', () => {
    const nodes = island().fallback?.({} as never, { abc: '' }, ctx('Example 3'));
    expect(nodes).toHaveLength(1);
    expect(nodes?.[0]).toMatchObject({ type: 'paragraph' });
  });

  it('has nothing to say about an empty figure', () => {
    expect(island().fallback?.({} as never, { abc: '   ' }, ctx())).toBeUndefined();
  });
});
