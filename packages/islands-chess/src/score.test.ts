import { describe, it, expect } from 'vitest';
import { pgnToTree, nodeAt } from './tree';
import { moveLabel, pgnScoreText, toScore } from './score';

describe('moveLabel', () => {
  const tree = pgnToTree('1. e4 e5 2. Bc4 Nc6 3. Qh5?!');

  it('names the initial position rather than a move', () => {
    expect(moveLabel(undefined)).toBe('Start');
  });

  it('numbers the move, not the ply', () => {
    expect(moveLabel(nodeAt(tree, '0'))).toBe('1. e4');
    expect(moveLabel(nodeAt(tree, '0.0'))).toBe('1... e5');
  });

  it('attaches the annotation glyph to the move', () => {
    expect(moveLabel(nodeAt(tree, '0.0.0.0.0'))).toBe('3. Qh5?!');
  });
});

describe('toScore', () => {
  it('groups moves into runs broken by commentary', () => {
    const { segments } = toScore(
      pgnToTree('1. e4 e5 2. Bc4 {Eyeing f7.} Nc6 3. Qh5 {And mate is threatened.}'),
    );

    expect(segments).toHaveLength(1);
    const { blocks } = segments[0];
    expect(blocks).toHaveLength(2);
    expect(blocks[0].moves.map((m) => `${m.number} ${m.san}`)).toEqual([
      '1. e4',
      '1... e5',
      '2. Bc4',
    ]);
    expect(blocks[0].comment).toBe('Eyeing f7.');
    expect(blocks[1].moves.map((m) => m.san)).toEqual(['Nc6', 'Qh5']);
    expect(blocks[1].comment).toBe('And mate is threatened.');
  });

  it('carries the path each move leads to, so the list can drive the board', () => {
    const { segments } = toScore(pgnToTree('1. e4 e5'));
    expect(segments[0].blocks[0].moves.map((m) => m.path)).toEqual(['0', '0.0']);
  });

  it('separates the pre-game comment from the moves', () => {
    const score = toScore(pgnToTree('{A miniature.} 1. e4 e5'));
    expect(score.intro).toBe('A miniature.');
    expect(score.segments[0].blocks[0].comment).toBeUndefined();
  });

  // A bare move list is one run, not one run per move.
  it('makes a single block of a game with no comments', () => {
    const { segments } = toScore(pgnToTree('1. e4 e5 2. Bc4 Nc6'));
    expect(segments[0].blocks).toHaveLength(1);
    expect(segments[0].blocks[0].moves).toHaveLength(4);
  });

  it('has nothing to say about an unparseable game', () => {
    expect(toScore(pgnToTree('~~~'))).toEqual({ intro: undefined, segments: [] });
  });
});

/**
 * A sideline interrupts the line at exactly the move it replaces, which is
 * where a printed book puts it — so the score is a sequence of lines, not one
 * run with footnotes.
 */
describe('toScore with sidelines', () => {
  const { segments } = toScore(pgnToTree('1. e4 e5 (1... d5 2. exd5) 2. Nf3 Nc6'));

  it('breaks the mainline where the sideline diverges, and resumes after it', () => {
    expect(segments.map((s) => s.depth)).toEqual([0, 1, 0]);
    expect(segments[0].blocks[0].moves.map((m) => m.san)).toEqual(['e4', 'e5']);
    expect(segments[1].blocks[0].moves.map((m) => m.san)).toEqual(['d5', 'exd5']);
    expect(segments[2].blocks[0].moves.map((m) => m.san)).toEqual(['Nf3', 'Nc6']);
  });

  it('marks the sideline as nested so it can be shown as one', () => {
    expect(segments[1].depth).toBe(1);
  });

  it('nests a sideline of a sideline one level deeper', () => {
    const nested = toScore(pgnToTree('1. e4 e5 (1... d5 2. exd5 (2. Nc3 dxe4)) 2. Nf3'));
    expect(nested.segments.map((s) => s.depth)).toEqual([0, 1, 2, 0]);
  });

  it('carries the note that introduces a line', () => {
    const introduced = toScore(pgnToTree('1. e4 e5 ({Sharper is} 1... c5 2. Nf3) 2. Nf3'));
    expect(introduced.segments[1].startingComment).toBe('Sharper is');
  });

  it('gives sideline moves their own paths, so clicking one is unambiguous', () => {
    expect(segments[1].blocks[0].moves.map((m) => m.path)).toEqual(['0.1', '0.1.0']);
  });
});

/**
 * The parser-free twin of `toScore`, used by the static fallback. It must
 * produce the same *shape* from the same game, or an exported book and a read
 * book would disagree about where the commentary falls.
 */
describe('pgnScoreText', () => {
  it('groups the source text the way toScore groups the tree', () => {
    const pgn = '1. e4 e5 2. Bc4 {Eyeing f7.} Nc6 3. Qh5 {And mate is threatened.}';
    const fromText = pgnScoreText(pgn);
    const replayed = toScore(pgnToTree(pgn));

    expect(fromText.blocks.map((b) => b.comment)).toEqual(
      replayed.segments[0].blocks.map((b) => b.comment),
    );
    expect(fromText.blocks[0].moves).toBe('1. e4 e5 2. Bc4');
  });

  it('separates the pre-game comment', () => {
    expect(pgnScoreText('{A miniature.} 1. e4 e5').intro).toBe('A miniature.');
  });

  it('strips shape tags, exactly as the board does', () => {
    const { blocks } = pgnScoreText('1. e4 {King pawn. [%cal Ge2e4]}');
    expect(blocks[0].comment).toBe('King pawn.');
  });

  it('drops PGN headers, which are metadata rather than score', () => {
    const { blocks } = pgnScoreText('[FEN "8/8/8/8/8/8/8/8 w - - 0 1"]\n[White "A"]\n\n1. e4 e5');
    expect(blocks).toEqual([{ moves: '1. e4 e5' }]);
  });

  it('joins two comments written against the same move', () => {
    const { blocks } = pgnScoreText('1. e4 {first} {second}');
    expect(blocks).toEqual([{ moves: '1. e4', comment: 'first second' }]);
  });

  it('keeps a trailing run of moves that no comment closes', () => {
    const { blocks } = pgnScoreText('1. e4 {King pawn.} e5 2. Bc4');
    expect(blocks[1]).toEqual({ moves: 'e5 2. Bc4' });
  });

  // Parenthesised in the source, parenthesised in the export: that is how a
  // book prints a sideline, so nothing has to understand them here.
  it('carries sidelines through as the author wrote them', () => {
    const { blocks } = pgnScoreText('1. e4 e5 (1... d5 2. exd5) 2. Nf3');
    expect(blocks[0].moves).toBe('1. e4 e5 (1... d5 2. exd5) 2. Nf3');
  });

  it('collapses the line breaks a PGN is wrapped at', () => {
    expect(pgnScoreText('1. e4\n   e5\n2. Bc4').blocks[0].moves).toBe('1. e4 e5 2. Bc4');
  });

  it('has nothing to say about an empty game', () => {
    expect(pgnScoreText('')).toEqual({ intro: undefined, blocks: [] });
  });
});
