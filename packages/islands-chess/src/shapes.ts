/**
 * Board arrows, square highlights and stored evaluations (SPEC008 G1.3, G10.1).
 *
 * Annotated PGN carries these inside move comments, in the de-facto standard
 * `[%cal …]` (arrows), `[%csl …]` (squares) and `[%eval …]` tags that Lichess,
 * ChessBase and SCID all write. Chessground draws the first two natively, so
 * the only work is reading them — and *removing* them from the comment, or the
 * reader is shown `[%cal Gd1h5]` in the middle of a sentence.
 *
 * **Every `[%…]` tag is removed, including ones we do not understand.** Real
 * PGN carries `[%clk]`, `[%ts]` and `[%cst]` too, and until 2026-09-30 each of
 * them rendered as prose because the pattern named only the two tags we
 * consumed. Stripping the shape rather than the list is the forgiving-runtime
 * promise applied to comments: an unreadable annotation costs the reader
 * nothing instead of leaking machine text into the page.
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

/**
 * Any `[%name value]` tag. The name is captured so a known tag can be consumed
 * and an unknown one still removed.
 *
 * The value is one unbounded run rather than `(?:\s+(…))?`: separating the
 * space from the value makes the two able to match the same characters, which
 * is both a backtracking ambiguity and what `security/detect-unsafe-regex`
 * objects to. Callers trim.
 */
const TAG = /\[%(\w+)([^\]]*)\]/g;

/**
 * A numeric evaluation (`0.54`, `-1.3`) or a forced mate (`#5`, `#-3`).
 *
 * Spelled as three flat alternatives rather than `\d+(?:\.\d+)?`, for the same
 * reason as {@link TAG}: a quantifier nested inside an optional group is star
 * height 2 and gets flagged, however unambiguous it actually is.
 */
const EVALUATION = /^(?:#-?\d+|[+-]?\d+\.\d+|[+-]?\d+)$/;

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
 * Normalises an `[%eval]` value, or returns nothing if it is not one.
 *
 * **The scale is White's, not the side to move's.** Verified against annotated
 * games: Black's inaccuracy moves the number *up*. A UCI score is reported from
 * the side to move and has to be negated for Black; a stored tag must not be,
 * and reusing the engine's conversion here would invert every Black move —
 * plausible on any single position, and invisible to a test that checks one.
 *
 * A leading `+` is dropped so the stored form is canonical; display adds the
 * sign back.
 */
function parseEvaluation(raw: string): string | undefined {
  const token = raw.trim();
  if (!token || !EVALUATION.test(token)) return undefined;
  return token.startsWith('+') ? token.slice(1) : token;
}

/**
 * Splits a PGN comment into the prose a reader should see and the annotations a
 * board should use. Always returns all three, so a caller cannot forget to
 * strip.
 */
export function extractAnnotations(comment: string): {
  text: string;
  shapes: MoveShape[];
  evaluation?: string;
} {
  const shapes: MoveShape[] = [];
  let evaluation: string | undefined;

  const text = comment
    .replace(TAG, (_tag, name: string, value: string) => {
      const tag = name.toLowerCase();
      if (tag === 'cal' || tag === 'csl') shapes.push(...parseShapes(value));
      // First one wins: several comments on one move are joined, and a
      // deterministic choice beats whichever happened to be written last.
      else if (tag === 'eval') evaluation ??= parseEvaluation(value);
      return '';
    })
    // A tag removed from mid-sentence leaves a double space behind.
    .replace(/\s+/g, ' ')
    .trim();

  return { text, shapes, ...(evaluation !== undefined ? { evaluation } : {}) };
}
