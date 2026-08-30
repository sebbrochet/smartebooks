import { describe, it, expect } from 'vitest';
import { pgnToPlies } from './pgn';

describe('pgnToPlies', () => {
  it('replays a short mainline into FENs + SANs', () => {
    const { fens, sans } = pgnToPlies('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#');
    expect(sans).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
    // one more FEN than moves (starting position + after each ply)
    expect(fens).toHaveLength(sans.length + 1);
    expect(fens[0]).toContain('rnbqkbnr/pppppppp'); // standard start
  });

  it('returns empty results for junk input', () => {
    expect(pgnToPlies('not a pgn at all ~~~')).toEqual({
      fens: expect.any(Array),
      sans: [],
      comments: expect.any(Array),
      nags: [],
      numbers: [],
      shapes: expect.any(Array),
    });
  });
});

/**
 * Chess numbers *moves*, not plies: `1. e4 e5` is move one, played by both
 * sides. A ply counter reads plausibly until an annotation cites a move number
 * and disagrees with the label beside it.
 */
describe('move numbering', () => {
  it('numbers White and Black within the same move', () => {
    expect(pgnToPlies('1. e4 e5 2. Bc4 Nc6').numbers).toEqual(['1.', '1...', '2.', '2...']);
  });

  it('takes the number from the position, so a FEN start is right', () => {
    // Black to move on move 3 — a ply counter would call this move one.
    const pgn =
      '[FEN "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]\n\n3... a6 4. Ba4';
    expect(pgnToPlies(pgn).numbers).toEqual(['3...', '4.']);
  });
});

/**
 * A PGN's `{…}` comments are the reason an annotated game is worth reading.
 * chessops parses them; the board used to discard them.
 */
describe('annotations', () => {
  it('keeps a comment against the position it describes', () => {
    const { comments } = pgnToPlies("1. e4 {King's pawn.} e5 2. Bc4 {The Bishop's Opening.}");
    // Indexed by ply, so comments[1] is "after 1. e4" — the position on the
    // board when the reader has stepped forward once.
    expect(comments[1]).toBe("King's pawn.");
    expect(comments[2]).toBeUndefined();
    expect(comments[3]).toBe("The Bishop's Opening.");
  });

  it('puts a comment written before the first move on the starting position', () => {
    const { comments } = pgnToPlies('{A famous miniature.} 1. e4 e5');
    expect(comments[0]).toBe('A famous miniature.');
  });

  it('has no comment at the start when none was written', () => {
    expect(pgnToPlies('1. e4 e5').comments[0]).toBeUndefined();
  });

  it('stays aligned with the plies', () => {
    const { fens, comments, sans, nags } = pgnToPlies('1. e4 {a} e5 2. Bc4 Nc6');
    expect(comments).toHaveLength(fens.length);
    expect(nags).toHaveLength(sans.length);
  });

  it('renders NAGs the way chess writing spells them', () => {
    const { nags } = pgnToPlies('1. e4 $1 e5 $6 2. Bc4 $3');
    expect(nags).toEqual(['!', '?!', '!!']);
  });

  // `$47` on a board would be noise, not annotation.
  it('drops NAGs it has no symbol for', () => {
    expect(pgnToPlies('1. e4 $47').nags).toEqual([undefined]);
  });

  it('joins consecutive comments on one move', () => {
    expect(pgnToPlies('1. e4 {first} {second}').comments[1]).toBe('first second');
  });

  it('ignores an empty comment rather than showing a blank note', () => {
    expect(pgnToPlies('1. e4 {   }').comments[1]).toBeUndefined();
  });
});

/**
 * Annotators draw on the board as well as writing about it. The tags live
 * inside the comment text, so keeping the shapes and keeping the prose readable
 * are the same problem.
 */
describe('board shapes', () => {
  it('lifts arrows out of a move comment and onto its ply', () => {
    const { shapes } = pgnToPlies('1. e4 e5 2. Bc4 {Eyeing f7. [%cal Gc4f7]}');
    expect(shapes[3]).toEqual([{ orig: 'c4', dest: 'f7', brush: 'green' }]);
  });

  it('removes the tag from the comment the reader is shown', () => {
    const { comments } = pgnToPlies('1. e4 e5 2. Bc4 {Eyeing f7. [%cal Gc4f7]}');
    expect(comments[3]).toBe('Eyeing f7.');
  });

  it('reads shapes written before the first move onto the starting position', () => {
    expect(pgnToPlies('{[%csl Re4]} 1. e4').shapes[0]).toEqual([{ orig: 'e4', brush: 'red' }]);
  });

  // A caller clears the board's shapes from this array, so a ply with none must
  // still have an entry rather than a hole.
  it('gives every ply an array, aligned with the comments', () => {
    const { comments, shapes } = pgnToPlies('1. e4 e5 2. Bc4 {[%cal Gc4f7]}');
    expect(shapes).toHaveLength(comments.length);
    expect(shapes[1]).toEqual([]);
  });

  it('leaves a comment that is only a tag with no text at all', () => {
    expect(pgnToPlies('1. e4 {[%cal Ge2e4]}').comments[1]).toBeUndefined();
  });
});
