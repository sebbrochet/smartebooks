import { describe, it, expect } from 'vitest';
import type { SmartbookDescriptor } from '@smart-ebooks/engine';
import { availablePacks, resolveIslands } from './islandPacks';

function descriptor(islands?: SmartbookDescriptor['islands']): SmartbookDescriptor {
  return { schemaVersion: 2, slug: 'demo', title: 'Demo', islands };
}

describe('resolveIslands', () => {
  it('gives a book the built-in islands when it declares no packs', () => {
    const names = resolveIslands(descriptor()).map((i) => i.name);
    expect(names).toContain('quiz');
    expect(names).not.toContain('chessboard');
  });

  it('adds a declared pack on top of the built-ins', () => {
    const names = resolveIslands(descriptor({ packs: { chess: {} } })).map((i) => i.name);
    expect(names).toContain('quiz');
    expect(names).toContain('chessboard');
  });

  it('passes per-book options through to the pack', () => {
    // Two books can configure the same pack differently, so options must not
    // live in module state.
    const blue = resolveIslands(descriptor({ packs: { chess: { board: { theme: 'blue' } } } }));
    const brown = resolveIslands(descriptor({ packs: { chess: { board: { theme: 'brown' } } } }));
    expect(blue.map((i) => i.name)).toEqual(brown.map((i) => i.name));
    expect(blue).not.toBe(brown);
  });

  it('fails loudly on an unknown pack rather than silently omitting it', () => {
    expect(() => resolveIslands(descriptor({ packs: { nope: {} } }))).toThrow(
      /unknown island pack/i,
    );
  });

  it('names the packs it can provide', () => {
    expect(availablePacks).toContain('chess');
  });
});
