/**
 * Per-board visual configuration (theme, piece set, orientation) for the chess
 * islands.
 *
 * Values are resolved through three layers, most specific wins:
 *   1. built-in defaults (`DEFAULT_BOARD_OPTIONS`)
 *   2. the book's defaults (`chessIslands({ board })`)
 *   3. per-directive attributes (`:::chessboard{theme=blue pieces=unicode}`)
 *
 * Resolution happens at parse time (in the island's `extract`), so components
 * receive a ready-made value. Every value is validated against a fixed
 * allow-list — imported/untrusted books can put arbitrary attributes on a
 * directive, and an unknown value must never reach a `className`.
 */

export const BOARD_THEMES = ['brown', 'blue', 'green', 'grey'] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];

export const PIECE_SETS = ['cburnett', 'unicode'] as const;
export type PieceSet = (typeof PIECE_SETS)[number];

/**
 * Which side the board is drawn from. `auto` means *the side to move*, which
 * needs a position and so is resolved by the component — see
 * {@link orientationFor} — rather than here.
 */
export const ORIENTATIONS = ['white', 'black', 'auto'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

/** What Chessground accepts, once `auto` has been resolved away. */
export type ResolvedOrientation = Exclude<Orientation, 'auto'>;

export interface BoardOptions {
  theme: BoardTheme;
  pieces: PieceSet;
  orientation: Orientation;
}

export const DEFAULT_BOARD_OPTIONS: BoardOptions = {
  theme: 'brown',
  pieces: 'cburnett',
  // `auto` rather than `white`: a puzzle or a diagram is nearly always meant to
  // be read from the side that has to move, and an ordinary game starts with
  // White to move — so this is the identity for existing content and the right
  // answer for the rest. An author who wants the other side says so.
  orientation: 'auto',
};

/** Returns `value` if it is a member of `allowed`, otherwise `fallback`. */
export function pickEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Resolves `auto` against a position. The side to move is FEN field 2; a FEN
 * that is missing, truncated or malformed is read as White to move, because an
 * orientation is a presentation choice and must never throw.
 */
export function orientationFor(
  orientation: Orientation | undefined,
  fen: string | undefined,
): ResolvedOrientation {
  if (orientation === 'white' || orientation === 'black') return orientation;
  return typeof fen === 'string' && fen.split(/\s+/)[1] === 'b' ? 'black' : 'white';
}

/**
 * Resolves directive attributes into a fully-validated {@link BoardOptions},
 * layering over `defaults` (which themselves default to the built-ins).
 *
 * `attributes` is typed for convenience but **must not be trusted**: it comes
 * from directive attributes in an imported book, or from that book's declared
 * pack options. A default parameter only fires on `undefined`, so `null` and
 * other non-objects are normalised explicitly rather than left to throw.
 */
export function resolveBoardOptions(
  attributes: Record<string, string> = {},
  defaults: BoardOptions = DEFAULT_BOARD_OPTIONS,
): BoardOptions {
  const source: Partial<Record<string, string>> =
    attributes !== null && typeof attributes === 'object' ? attributes : {};

  return {
    theme: pickEnum(source.theme, BOARD_THEMES, defaults.theme),
    pieces: pickEnum(source.pieces, PIECE_SETS, defaults.pieces),
    orientation: pickEnum(source.orientation, ORIENTATIONS, defaults.orientation),
  };
}
