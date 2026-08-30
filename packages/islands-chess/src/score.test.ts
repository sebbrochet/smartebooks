import { describe, it, expect } from 'vitest';
import { pgnToPlies } from './pgn';
import { moveLabel, pgnScoreText, toScore } from './score';

describe('moveLabel', () => {
  const plies = pgnToPlies('1. e4 e5 2. Bc4 Nc6 3. Qh5?!');

  it('names the initial position rather than a move', () => {
    expect(moveLabel(plies, 0)).toBe('Start');
  });

  it('numbers the move, not the ply', () => {
    expect(moveLabel(plies, 1)).toBe('1. e4');
    expect(moveLabel(plies, 2)).toBe('1... e5');
    expect(moveLabel(plies, 3)).toBe('2. Bc4');
  });

  it('attaches the annotation glyph to the move', () => {
    expect(moveLabel(plies, 5)).toBe('3. Qh5?!');
  });

  // Called with a persisted ply from an older, longer game, it must not throw.
  it('degrades to something printable when the ply is out of range', () => {
    expect(moveLabel(plies, 99)).toBe('');
    expect(moveLabel(plies, -1)).toBe('Start');
  });
});

describe('toScore', () => {
  it('groups moves into runs broken by commentary', () => {
    const { blocks } = toScore(
      pgnToPlies('1. e4 e5 2. Bc4 {Eyeing f7.} Nc6 3. Qh5 {And mate is threatened.}'),
    );

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

  it('carries the ply each move leads to, so the list can drive the board', () => {
    const { blocks } = toScore(pgnToPlies('1. e4 e5'));
    expect(blocks[0].moves.map((m) => m.ply)).toEqual([1, 2]);
  });

  it('separates the pre-game comment from the moves', () => {
    const score = toScore(pgnToPlies('{A miniature.} 1. e4 e5'));
    expect(score.intro).toBe('A miniature.');
    expect(score.blocks[0].comment).toBeUndefined();
  });

  // A bare move list is one block, not one block per move.
  it('makes a single block of a game with no comments', () => {
    const { blocks } = toScore(pgnToPlies('1. e4 e5 2. Bc4 Nc6'));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].moves).toHaveLength(4);
    expect(blocks[0].comment).toBeUndefined();
  });

  it('closes the last block even when the game ends without a comment', () => {
    const { blocks } = toScore(pgnToPlies('1. e4 {King pawn.} e5 2. Bc4'));
    expect(blocks).toHaveLength(2);
    expect(blocks[1].comment).toBeUndefined();
    expect(blocks[1].moves.map((m) => m.san)).toEqual(['e5', 'Bc4']);
  });

  it('has nothing to say about an unparseable game', () => {
    expect(toScore(pgnToPlies('~~~'))).toEqual({ intro: undefined, blocks: [] });
  });
});

/**
 * The parser-free twin of `toScore`, used by the static fallback. It must
 * produce the same *shape* from the same game, or an exported book and a read
 * book would disagree about where the commentary falls.
 */
describe('pgnScoreText', () => {
  it('groups the source text into the same blocks toScore produces', () => {
    const pgn = '1. e4 e5 2. Bc4 {Eyeing f7.} Nc6 3. Qh5 {And mate is threatened.}';
    const fromText = pgnScoreText(pgn);
    const replayed = toScore(pgnToPlies(pgn));

    expect(fromText.blocks).toHaveLength(replayed.blocks.length);
    expect(fromText.blocks.map((b) => b.comment)).toEqual(replayed.blocks.map((b) => b.comment));
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

  it('collapses the line breaks a PGN is wrapped at', () => {
    expect(pgnScoreText('1. e4\n   e5\n2. Bc4').blocks[0].moves).toBe('1. e4 e5 2. Bc4');
  });

  it('has nothing to say about an empty game', () => {
    expect(pgnScoreText('')).toEqual({ intro: undefined, blocks: [] });
  });
});
