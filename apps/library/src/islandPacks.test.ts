import { describe, it, expect } from 'vitest';
import {
  makeImportedBook,
  missingIslands,
  type SmartbookDescriptor,
  type StoredImport,
} from '@smart-ebooks/engine';
import { availablePacks, resolveIslands, resolveImportedIslands } from './islandPacks';
import { BOARD_THEMES, PIECE_SETS, resolveBoardOptions } from '@smart-ebooks/islands-chess';

function descriptor(islands?: SmartbookDescriptor['islands']): SmartbookDescriptor {
  return { schemaVersion: 2, slug: 'demo', title: 'Demo', islands };
}

describe('resolveIslands', () => {
  it('gives a book the built-in islands when it declares no packs', () => {
    const names = resolveIslands(descriptor()).map((i) => i.name);
    expect(names).toContain('quiz');
    expect(names).not.toContain('chess-board');
  });

  it('adds a declared pack on top of the built-ins', () => {
    const names = resolveIslands(descriptor({ packs: { chess: {} } })).map((i) => i.name);
    expect(names).toContain('quiz');
    expect(names).toContain('chess-board');
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

/**
 * An imported book gets the same packs a bundled one would — otherwise a chess
 * `.smartbook` renders placeholders on a platform that ships the chess pack,
 * and P2.1's "this reader cannot display" notice tells the reader something
 * untrue.
 */
describe('resolveImportedIslands', () => {
  it('gives an imported book the pack it declares', () => {
    const names = resolveImportedIslands(descriptor({ packs: { chess: {} } })).map((i) => i.name);
    expect(names).toContain('chess-board');
  });

  // A bundled book with a bad pack name is an authoring error worth stopping
  // for. An imported one may have been made against a platform with packs this
  // build lacks; throwing would take down the whole shelf over one bad file.
  it('omits an unknown pack instead of throwing', () => {
    const islands = resolveImportedIslands(descriptor({ packs: { nope: {}, chess: {} } }));
    const names = islands.map((i) => i.name);
    expect(names).toContain('quiz');
    expect(names).toContain('chess-board');
    expect(names).not.toContain('nope');
  });

  it('still yields the built-ins when every declared pack is unknown', () => {
    const names = resolveImportedIslands(descriptor({ packs: { nope: {} } })).map((i) => i.name);
    expect(names).toContain('quiz');
  });
});

/**
 * Pack options now arrive from a descriptor inside an untrusted zip, so the
 * pack must validate them rather than trust the declared TypeScript shape.
 */
describe('untrusted pack options', () => {
  const hostile = [
    { board: { theme: '"><script>alert(1)</script>' } },
    { board: { theme: 'brown; --x: url(evil)' } },
    { board: { theme: 42, pieces: null } },
    { board: 'not-an-object' },
    { board: null },
    'not-an-object',
    null,
    42,
    [],
  ];

  it.each(hostile)('survives a hostile options value: %j', (options) => {
    expect(() => resolveImportedIslands(descriptor({ packs: { chess: options } }))).not.toThrow();
  });

  // The value that matters most: a theme reaches a className, so an unknown one
  // must never survive resolution.
  it('never lets an unrecognised theme or piece set through', () => {
    const resolved = resolveBoardOptions({
      theme: '"><script>',
      pieces: '../../etc/passwd',
    } as Record<string, string>);
    expect(BOARD_THEMES).toContain(resolved.theme);
    expect(PIECE_SETS).toContain(resolved.pieces);
  });
});

/**
 * The whole point of the change, end to end: a chess book packaged elsewhere
 * and imported here must render its chess islands, and must *not* be announced
 * as unreadable by P2.1's notice.
 */
describe('an imported chess book', () => {
  const stored: StoredImport = {
    id: 'imp-chess',
    descriptor: {
      schemaVersion: 2,
      slug: 'openings',
      title: 'Openings',
      visibility: 'private',
      islands: {
        packs: { chess: { board: { theme: 'blue' } } },
        required: ['chess-board', 'quiz'],
      },
    },
    content: { 'content/01-open.md': '# Open\n\n::chess-board{id="b"}\n' },
    assets: {},
    importedAt: 0,
  };

  it('receives the chess islands the platform ships', () => {
    const book = makeImportedBook(stored, resolveImportedIslands(stored.descriptor));
    expect(book.islands.map((i) => i.name)).toContain('chess-board');
  });

  it('reports nothing missing, because nothing is', () => {
    const book = makeImportedBook(stored, resolveImportedIslands(stored.descriptor));
    expect(missingIslands(book.descriptor, book.islands)).toEqual([]);
  });

  it('still reports a pack this platform genuinely lacks', () => {
    const descriptor = {
      ...stored.descriptor,
      islands: { packs: { sheetmusic: {} }, required: ['score'] },
    };
    const book = makeImportedBook({ ...stored, descriptor }, resolveImportedIslands(descriptor));
    expect(missingIslands(book.descriptor, book.islands)).toEqual(['score']);
  });
});
