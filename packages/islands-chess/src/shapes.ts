/**
 * Board arrows and square highlights (SPEC008 G1.3).
 *
 * Annotated PGN carries these inside move comments, in the de-facto standard
 * `[%cal …]` (arrows) and `[%csl …]` (squares) tags that Lichess, ChessBase and
 * SCID all write. Chessground draws them natively, so the only work is reading
 * them — and *removing* them from the comment, or the reader is shown
 * `[%cal Gd1h5]` in the middle of a sentence.
 *
 * Pure and dependency-free at runtime: the only Chessground import is a
 * **type**, which is erased, so this module still runs at parse time and is
 * testable without a DOM. Typing the squares as `Key` rather than `string` is
 * what lets a board take these shapes directly, with the one unavoidable cast
 * kept next to the check that makes it true.
 */

import type { Key } from 'chessground/types';

export interface MoveShape {
  /** Origin square, e.g. `d1`. Also the highlighted square when `dest` is absent. */
  orig: Key;
  /** Destination square; present for arrows, absent for square highlights. */
  dest?: Key;
  /** A Chessground brush name. */
  brush: string;
}

/**
 * The four colours the tag syntax defines. Anything else is dropped rather than
 * passed through: an unknown brush name reaches a CSS class, and content may be
 * untrusted.
 */
const BRUSHES: Record<string, string> = {
  G: 'green',
  R: 'red',
  Y: 'yellow',
  B: 'blue',
};

const SQUARE = /^[a-h][1-8]$/;
const TAG = /\[%(?:cal|csl)\s+([^\]]*)\]/gi;

/** `Gd1h5` → an arrow; `Rf7` → a highlighted square; anything else → nothing. */
function parseToken(raw: string): MoveShape | undefined {
  const brush = BRUSHES[raw.slice(0, 1).toUpperCase()];
  if (!brush) return undefined;

  const squares = raw.slice(1).toLowerCase();
  if (squares.length === 2) {
    return SQUARE.test(squares) ? { orig: squares as Key, brush } : undefined;
  }
  if (squares.length === 4) {
    const orig = squares.slice(0, 2);
    const dest = squares.slice(2);
    return SQUARE.test(orig) && SQUARE.test(dest)
      ? { orig: orig as Key, dest: dest as Key, brush }
      : undefined;
  }
  return undefined;
}

/**
 * Parses a bare token list — `"Gd1h5,Rf7"` or `"Gd1h5 Rf7"` — which is what an
 * author writes in a `shapes` attribute. Same syntax as the PGN tags, so there
 * is only one thing to learn.
 */
export function parseShapes(list: string | undefined): MoveShape[] {
  if (!list) return [];
  return list
    .split(/[\s,]+/)
    .map((token) => parseToken(token))
    .filter((shape): shape is MoveShape => shape !== undefined);
}

/**
 * Splits a PGN comment into the prose a reader should see and the shapes a
 * board should draw. Always returns both, so a caller cannot forget to strip.
 */
export function extractShapes(comment: string): { text: string; shapes: MoveShape[] } {
  const shapes: MoveShape[] = [];
  const text = comment
    .replace(TAG, (_tag, list: string) => {
      shapes.push(...parseShapes(list));
      return '';
    })
    // A tag removed from mid-sentence leaves a double space behind.
    .replace(/\s+/g, ' ')
    .trim();

  return { text, shapes };
}
