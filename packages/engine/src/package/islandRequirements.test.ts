import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { exportBookToZip } from './exportBook';
import { deriveRequiredIslands, missingIslands, collectDirectiveNames } from './islandRequirements';
import { makeImportedBook } from '../store/importedBooks';
import { defaultIslands } from '../islands/defaults';
import type { Book } from '../types';
import type { IslandDefinition } from '../islandRegistry';
import type { StoredImport } from '../store/importedBooks';

/**
 * SPEC001 P2.1 — packages declare which islands they need, so a reader that
 * lacks one can say so once instead of scattering unexplained placeholders.
 */

const chessBoard: IslandDefinition = {
  name: 'chess-board',
  aliases: ['chessboard'],
  component: () => null,
};

function makeChessBook(markdown: string): Book {
  return {
    meta: { slug: 'chess', title: 'Chess', description: '' },
    chapters: [{ slug: '01-open', title: 'Openings', order: 1, markdown }],
    descriptor: { schemaVersion: 2, slug: 'chess', title: 'Chess', visibility: 'public' },
    islands: [...defaultIslands, chessBoard],
  } as Book;
}

describe('collectDirectiveNames', () => {
  it('finds container and leaf directives, without duplicates', () => {
    const md = ':::quiz{id="q"}\ntext\n:::\n\n::video{id="v" src="x"}\n\n::video{id="w" src="y"}\n';
    expect(collectDirectiveNames(md)).toEqual(['quiz', 'video']);
  });
});

describe('deriveRequiredIslands', () => {
  it('lists the islands the content actually uses', () => {
    const book = makeChessBook('::video{id="v" src="assets/a.mp4"}\n\n::chess-board{id="b"}\n');
    expect(deriveRequiredIslands(book)).toEqual(['chess-board', 'video']);
  });

  it('records an alias under its canonical name', () => {
    const book = makeChessBook('::chessboard{id="b"}\n');
    expect(deriveRequiredIslands(book)).toEqual(['chess-board']);
  });

  it('ignores directives that are not islands', () => {
    const book = makeChessBook('::somethingelse{id="x"}\n');
    expect(deriveRequiredIslands(book)).toEqual([]);
  });

  // A reader without the chess pack cannot recognise `::chess-board`. If export
  // derived requirements only from what it understands, re-exporting would
  // silently strip the requirement and the next reader would get no warning.
  it('keeps a declared requirement it cannot recognise', () => {
    const book = makeChessBook('# Just text\n');
    book.islands = defaultIslands;
    book.descriptor.islands = { required: ['chess-board'] };
    expect(deriveRequiredIslands(book)).toEqual(['chess-board']);
  });
});

describe('exportBookToZip', () => {
  it('writes the required islands into the descriptor', () => {
    const book = makeChessBook('::chess-board{id="b"}\n\n::audio{id="a" src="assets/a.mp3"}\n');
    const entries = unzipSync(exportBookToZip(book));
    const descriptor = JSON.parse(strFromU8(entries['smartbook.json']));
    expect(descriptor.islands.required).toEqual(['audio', 'chess-board']);
  });

  it('preserves pack options alongside the derived requirements', () => {
    const book = makeChessBook('::chess-board{id="b"}\n');
    book.descriptor.islands = { packs: { chess: { engine: 'stockfish' } } };
    const entries = unzipSync(exportBookToZip(book));
    const descriptor = JSON.parse(strFromU8(entries['smartbook.json']));
    expect(descriptor.islands.packs).toEqual({ chess: { engine: 'stockfish' } });
    expect(descriptor.islands.required).toEqual(['chess-board']);
  });
});

describe('missingIslands', () => {
  it('reports nothing when the book declares no requirements', () => {
    expect(missingIslands({}, defaultIslands)).toEqual([]);
  });

  it('reports nothing when every requirement is available', () => {
    expect(missingIslands({ islands: { required: ['quiz', 'audio'] } }, defaultIslands)).toEqual(
      [],
    );
  });

  it('reports an island this reader cannot provide', () => {
    const descriptor = { islands: { required: ['quiz', 'chess-board'] } };
    expect(missingIslands(descriptor, defaultIslands)).toEqual(['chess-board']);
  });

  it('does not report a book that declares an old alias', () => {
    const descriptor = { islands: { required: ['chessboard'] } };
    expect(missingIslands(descriptor, [...defaultIslands, chessBoard])).toEqual([]);
  });
});

// The end-to-end point of P2.1: an imported book gets only the built-in
// islands, so a chess book imported here must announce what is missing.
describe('an imported chess book', () => {
  it('tells the reader which islands it cannot display', () => {
    const source = makeChessBook('::chess-board{id="b"}\n\n::quiz{id="q"}\n');
    const entries = unzipSync(exportBookToZip(source));
    const descriptor = JSON.parse(strFromU8(entries['smartbook.json']));

    const stored: StoredImport = {
      id: 'imp-1',
      descriptor,
      content: { 'content/01-open.md': source.chapters[0].markdown },
      assets: {},
      importedAt: Date.now(),
    };
    const imported = makeImportedBook(stored);

    expect(missingIslands(imported.descriptor, imported.islands)).toEqual(['chess-board']);
  });
});
