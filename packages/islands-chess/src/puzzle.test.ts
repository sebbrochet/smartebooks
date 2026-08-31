import { describe, it, expect } from 'vitest';
import { play, playSan, positionFrom, sameMove, solutionMoves } from './puzzle';

const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
const BLACK_TO_MOVE = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

describe('positionFrom', () => {
  it('reports whose move it is, which is who the puzzle is for', () => {
    expect(positionFrom(BACK_RANK)?.turn).toBe('white');
    expect(positionFrom(BLACK_TO_MOVE)?.turn).toBe('black');
  });

  it('offers only legal destinations', () => {
    const dests = positionFrom(BACK_RANK)?.dests;
    expect(dests?.get('a1')).toContain('a8');
    expect(dests?.get('a1')).not.toContain('h1'); // own king in the way
    expect(dests?.has('g8')).toBe(false); // not Black's move
  });

  // An imported book can carry anything; a bad puzzle must cost the reader the
  // puzzle, not the page.
  it('gives up quietly on a position it cannot read', () => {
    expect(positionFrom('not a fen')).toBeUndefined();
    expect(positionFrom('')).toBeUndefined();
    // Structurally a FEN, but not a legal chess position.
    expect(positionFrom('8/8/8/8/8/8/8/8 w - - 0 1')).toBeUndefined();
  });
});

describe('solutionMoves', () => {
  it('reads a single move', () => {
    expect(solutionMoves('Ra8#')).toEqual(['Ra8#']);
  });

  it('reads a line, however the author spaced it', () => {
    expect(solutionMoves('Ra8+ Kh7 Rh8#')).toEqual(['Ra8+', 'Kh7', 'Rh8#']);
    expect(solutionMoves('Ra8+, Kh7, Rh8#')).toEqual(['Ra8+', 'Kh7', 'Rh8#']);
  });

  // An author will type move numbers. They say nothing a SAN list does not.
  it('drops move numbers', () => {
    expect(solutionMoves('1. Ra8+ 1... Kh7 2. Rh8#')).toEqual(['Ra8+', 'Kh7', 'Rh8#']);
  });

  it('has no moves for an absent or empty solution', () => {
    expect(solutionMoves(undefined)).toEqual([]);
    expect(solutionMoves('   ')).toEqual([]);
  });
});

describe('play', () => {
  it('names the move it played in the notation a solution is written in', () => {
    expect(play(BACK_RANK, 'a1', 'a8').san).toBe('Ra8#');
  });

  it('reports the position after, so a reply can be played on it', () => {
    expect(play(BACK_RANK, 'a1', 'a4').fen).toContain(' b ');
  });

  it('refuses a move that is not legal rather than inventing one', () => {
    expect(play(BACK_RANK, 'a1', 'h1')).toEqual({}); // blocked by the king
    expect(play(BACK_RANK, 'g8', 'g7')).toEqual({}); // not White's move
    expect(play(BACK_RANK, 'zz', 'a8')).toEqual({});
    expect(play('not a fen', 'a1', 'a8')).toEqual({});
  });

  it('promotes to a queen', () => {
    expect(play('8/P6k/8/8/8/8/8/6K1 w - - 0 1', 'a7', 'a8').san).toBe('a8=Q');
  });
});

describe('playSan', () => {
  it('plays the reply a solution line expects', () => {
    expect(playSan(BACK_RANK, 'Ra4')).toContain(' b ');
  });

  it('returns nothing for a move that cannot be played', () => {
    expect(playSan(BACK_RANK, 'Qz9')).toBeUndefined();
    expect(playSan('not a fen', 'Ra8#')).toBeUndefined();
  });
});

/**
 * Marking a reader wrong over punctuation would be indefensible: `Ra8#` and
 * `Ra8` are the same move, and only one of them is what the board produced.
 */
describe('sameMove', () => {
  it('ignores check, mate and quality marks', () => {
    expect(sameMove('Ra8#', 'Ra8')).toBe(true);
    expect(sameMove('Ra8+!', 'Ra8')).toBe(true);
    expect(sameMove('Nf3!?', 'Nf3')).toBe(true);
  });

  it('still tells different moves apart', () => {
    expect(sameMove('Ra8#', 'Ra7')).toBe(false);
    expect(sameMove('Nf3', 'Nc3')).toBe(false);
  });
});

/**
 * A solution line the board cannot actually produce fails in the worst way: the
 * reader plays the right move and is told they are wrong. Cheap to get wrong
 * too — the first draft of the bundled puzzle asked for a rook capture that was
 * not a rook move.
 */
describe('the bundled puzzle line', () => {
  const start = '5rk1/5ppp/8/8/8/8/1R3PPP/1R4K1 w - - 0 1';
  const line = solutionMoves('Rb8 Rxb8 Rxb8#');

  it('is playable from the board, move for move', () => {
    const first = play(start, 'b2', 'b8');
    expect(first.san).toBeDefined();
    expect(sameMove(first.san!, line[0])).toBe(true);

    const afterReply = playSan(first.fen!, line[1]);
    expect(afterReply).toBeDefined();

    const second = play(afterReply!, 'b1', 'b8');
    expect(second.san).toBeDefined();
    expect(sameMove(second.san!, line[2])).toBe(true);
  });

  it('really is mate, which is what the chapter claims', () => {
    const first = play(start, 'b2', 'b8');
    const afterReply = playSan(first.fen!, line[1]);
    expect(play(afterReply!, 'b1', 'b8').san).toContain('#');
  });
});
