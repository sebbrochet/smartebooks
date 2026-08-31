import { makeFen, parseFen } from 'chessops/fen';
import { Chess } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { makeSan, parseSan } from 'chessops/san';
import { parseSquare } from 'chessops/util';
import type { Key } from 'chessground/types';

/**
 * Just enough rules to check a puzzle answer (SPEC008 G3.3).
 *
 * A puzzle used to reveal its answer and ask the reader to tick a box, which is
 * the difference between a book that *tests* and a book that *tells*. Checking
 * needs legal moves and SAN, both of which `chessops` already provides; this is
 * the thin layer that keeps that dependency out of the component, and out of
 * anything that has to run at parse time.
 *
 * Every function is total: a malformed FEN in an untrusted book returns
 * `undefined` rather than throwing, because a bad puzzle must cost the reader
 * the puzzle and not the page.
 */

export interface PuzzlePosition {
  /** Legal destinations per origin square, in Chessground's shape. */
  dests: Map<Key, Key[]>;
  /** Whose move it is — the side the reader plays. */
  turn: 'white' | 'black';
}

function positionOf(fen: string): Chess | undefined {
  try {
    return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  } catch {
    return undefined;
  }
}

/** Reads a FEN into what a board needs to be made playable. */
export function positionFrom(fen: string): PuzzlePosition | undefined {
  const position = positionOf(fen);
  if (!position) return undefined;
  return {
    dests: chessgroundDests(position) as Map<Key, Key[]>,
    turn: position.turn,
  };
}

/**
 * The moves a solution asks for, as SAN.
 *
 * Written as an attribute rather than a body micro-format: the body stays the
 * author's prose explanation, and there is no second little language to learn,
 * to document, or to lint (SPEC001 L10). Move numbers are tolerated in the
 * source because an author will type them, and dropped because they say nothing
 * a SAN list does not.
 */
export function solutionMoves(solution: string | undefined): string[] {
  return (solution ?? '')
    .split(/[\s,]+/)
    .map((token) => token.replace(/^\d+\.+/, '').trim())
    .filter(Boolean);
}

export interface PlayResult {
  /** SAN of the move that was played; absent if it was not legal. */
  san?: string;
  /** FEN after it, for playing the reply a solution line expects. */
  fen?: string;
}

/**
 * Plays a board move, reporting the SAN it produced so it can be compared with
 * the solution. Promotion is always to a queen: a puzzle whose point is an
 * underpromotion deserves its own feature rather than a guess made here.
 */
export function play(fen: string, orig: string, dest: string): PlayResult {
  const position = positionOf(fen);
  const from = parseSquare(orig);
  const to = parseSquare(dest);
  if (!position || from === undefined || to === undefined) return {};

  const move = [
    { from, to },
    { from, to, promotion: 'queen' as const },
  ].find((candidate) => position.isLegal(candidate));
  if (!move) return {};

  const san = makeSan(position, move);
  position.play(move);
  return { san, fen: makeFen(position.toSetup()) };
}

/** Plays a SAN move, for the reply a solution line expects. */
export function playSan(fen: string, san: string): string | undefined {
  const position = positionOf(fen);
  if (!position) return undefined;
  const move = parseSan(position, san);
  if (!move) return undefined;
  position.play(move);
  return makeFen(position.toSetup());
}

/**
 * Whether two SAN strings name the same move.
 *
 * Compared without the annotation glyphs an author may have typed — `Ra8#`,
 * `Ra8+!` and `Ra8` are one move, and marking a reader wrong over punctuation
 * would be indefensible.
 */
export function sameMove(a: string, b: string): boolean {
  const bare = (san: string) => san.replace(/[+#!?]+$/g, '');
  return bare(a) === bare(b);
}
