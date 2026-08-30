import type { PgnPlies } from './pgn';
import { extractShapes } from './shapes';

/**
 * The game score, grouped the way chess is written down (SPEC008 G2.1/G2.2).
 *
 * Printed chess books run the moves together and break for commentary:
 * `1. e4 e5 2. Bc4`, then a paragraph about f7, then `Nc6 3. Qh5?!`. This
 * module produces that structure twice over, from two different inputs:
 *
 * - {@link toScore} works from a **replayed** game, for the interactive move
 *   list, which needs a ply per move so a click can drive the board.
 * - {@link pgnScoreText} works from the **PGN text**, for the static fallback.
 *
 * The duplication is deliberate and was measured. The fallback runs at parse
 * time, in the module every reader loads, so replaying the game there would
 * put `chessops` in the main bundle for every book on the shelf — **+45.9 kB,
 * +13.2 kB gzipped**, verified by building it both ways. A fallback does not
 * need legal-move validation: a PGN already interleaves moves and comments in
 * reading order, so splitting on `{…}` reproduces the same blocks, and keeps
 * the author's own notation while it is at it.
 *
 * Pure and dependency-free either way.
 */

export interface ScoreMove {
  /** Ply this move leads to, i.e. what the board should show. */
  ply: number;
  /** `1.` for White, `1...` for Black. */
  number: string;
  /** SAN with any annotation glyph attached: `Qh5?!`. */
  san: string;
}

export interface ScoreBlock {
  /** A run of moves with no commentary between them. */
  moves: ScoreMove[];
  /** The annotator's note on the position after the last move in `moves`. */
  comment?: string;
}

export interface Score {
  /** A comment written before the first move: the game's introduction. */
  intro?: string;
  blocks: ScoreBlock[];
}

/** `3. Qh5?!`, or `Start` for the initial position. */
export function moveLabel(plies: PgnPlies, ply: number): string {
  if (ply <= 0) return 'Start';
  const index = ply - 1;
  return `${plies.numbers[index] ?? ''} ${plies.sans[index] ?? ''}${plies.nags[index] ?? ''}`.trim();
}

/**
 * Groups a replayed game into runs of moves punctuated by commentary.
 *
 * A block is closed by the comment that belongs to its last move, so a game
 * with no comments at all is a single block — which is the right rendering for
 * a bare move list.
 */
export function toScore(plies: PgnPlies): Score {
  const blocks: ScoreBlock[] = [];
  let current: ScoreMove[] = [];

  for (let ply = 1; ply < plies.fens.length; ply++) {
    const index = ply - 1;
    current.push({
      ply,
      number: plies.numbers[index] ?? '',
      san: `${plies.sans[index] ?? ''}${plies.nags[index] ?? ''}`,
    });

    const comment = plies.comments[ply];
    if (comment) {
      blocks.push({ moves: current, comment });
      current = [];
    }
  }

  if (current.length > 0) blocks.push({ moves: current });

  return { intro: plies.comments[0], blocks };
}

/** A run of moves as the author typed them, and the comment that closes it. */
export interface TextBlock {
  moves: string;
  comment?: string;
}

/** PGN header lines (`[FEN "…"]`) — metadata, not part of the score. */
const HEADER = /^[ \t]*\[[^\]]*\][ \t]*$/gm;
const COMMENT = /\{([^}]*)\}/g;

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * The same grouping as {@link toScore}, taken straight from the PGN text so it
 * costs no parser. Shape tags are stripped from the comments, exactly as the
 * board strips them, or an export would print `[%cal Gd1h5]` mid-sentence.
 */
export function pgnScoreText(pgn: string): { intro?: string; blocks: TextBlock[] } {
  const body = pgn.replace(HEADER, '');
  const blocks: TextBlock[] = [];
  let intro: string | undefined;
  let cursor = 0;

  for (const match of body.matchAll(COMMENT)) {
    const moves = collapse(body.slice(cursor, match.index));
    const comment = extractShapes(match[1]).text;
    cursor = (match.index ?? 0) + match[0].length;

    if (!moves) {
      // A comment with no moves before it: either the game's introduction, or
      // the second of two consecutive comments on the same move.
      if (!comment) continue;
      if (blocks.length === 0) intro = intro ? `${intro} ${comment}` : comment;
      else {
        const last = blocks[blocks.length - 1];
        last.comment = last.comment ? `${last.comment} ${comment}` : comment;
      }
      continue;
    }

    blocks.push({ moves, comment: comment || undefined });
  }

  const tail = collapse(body.slice(cursor));
  if (tail) blocks.push({ moves: tail });

  return { intro, blocks };
}
