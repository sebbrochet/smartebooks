import { parsePgn, startingPosition } from 'chessops/pgn';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { extractShapes, type MoveShape } from './shapes';

export interface PgnPlies {
  /** FEN after each ply, index 0 = starting position. */
  fens: string[];
  /** SAN of each played move (fens.length === sans.length + 1). */
  sans: string[];
  /**
   * The annotator's comment *about the position you are looking at*, indexed by
   * ply so it lines up with `fens`. Index 0 is a comment written before the
   * first move (PGN calls those `startingComments`), which is where a game
   * introduction lives.
   */
  comments: (string | undefined)[];
  /** Move-quality/evaluation symbol per move, indexed like `sans`. */
  nags: (string | undefined)[];
  /**
   * Move number prefix per move, indexed like `sans`: `1.` for White, `1...`
   * for Black. Chess numbers *moves*, not plies — `1. e4 e5` is one move — so a
   * ply counter would disagree with any annotation that cites a move number.
   * Taken from the position, so a game starting from a FEN numbers correctly.
   */
  numbers: string[];
  /**
   * Arrows and highlights the annotator drew for each position, indexed by ply
   * like `comments`. Empty for a ply with none, never `undefined`, so a caller
   * can clear the board's shapes unconditionally.
   */
  shapes: MoveShape[][];
}

/**
 * Numeric Annotation Glyphs, as chess writing spells them.
 *
 * A deliberate subset: the move-quality marks an annotator reaches for, plus
 * the common evaluation symbols. Anything else is dropped rather than shown
 * raw — `$47` on a board would be noise, not annotation.
 */
const NAGS: Record<number, string> = {
  1: '!',
  2: '?',
  3: '!!',
  4: '??',
  5: '!?',
  6: '?!',
  10: '=',
  13: '∞',
  14: '⩲',
  15: '⩱',
  16: '±',
  17: '∓',
  18: '+−',
  19: '−+',
};

/**
 * Join a move's comments (PGN allows several in a row) and split the board
 * shapes out of them, so the prose and the drawing are never confused.
 */
function annotation(comments: string[] | undefined): {
  text: string | undefined;
  shapes: MoveShape[];
} {
  const shapes: MoveShape[] = [];
  const parts: string[] = [];

  for (const comment of comments ?? []) {
    const split = extractShapes(comment);
    shapes.push(...split.shapes);
    if (split.text) parts.push(split.text);
  }

  return { text: parts.length > 0 ? parts.join(' ') : undefined, shapes };
}

/**
 * Replay a PGN's mainline into a FEN-per-ply list (plus SAN labels). Pure and
 * dependency-light enough to run at parse time or in the board island.
 *
 * Annotations are kept, not discarded: a PGN's `{…}` comments are the reason
 * annotated games are worth reading, and chessops already parses them.
 */
export function pgnToPlies(pgn: string): PgnPlies {
  const empty: PgnPlies = {
    fens: [],
    sans: [],
    comments: [],
    nags: [],
    numbers: [],
    shapes: [],
  };

  try {
    const game = parsePgn(pgn)[0];
    if (!game) return empty;

    const pos = startingPosition(game.headers).unwrap();
    const fens = [makeFen(pos.toSetup())];
    const sans: string[] = [];
    const comments: (string | undefined)[] = [];
    const nags: (string | undefined)[] = [];
    const numbers: string[] = [];
    const shapes: MoveShape[][] = [];

    // A comment before the first move is a *game* comment in PGN, not a
    // property of the first move — chessops keeps it on the game. It describes
    // the starting position, which is ply 0.
    const opening = annotation(game.comments);
    comments.push(opening.text);
    shapes.push(opening.shapes);

    let node = game.moves;
    while (node.children.length > 0) {
      const child = node.children[0];
      const move = parseSan(pos, child.data.san);
      if (!move) break;

      // Read the number *before* playing: that is whose move it is.
      numbers.push(pos.turn === 'white' ? `${pos.fullmoves}.` : `${pos.fullmoves}...`);
      pos.play(move);

      const annotated = annotation(child.data.comments);
      sans.push(child.data.san);
      fens.push(makeFen(pos.toSetup()));
      comments.push(annotated.text);
      shapes.push(annotated.shapes);
      nags.push(child.data.nags?.map((nag) => NAGS[nag] ?? '').join('') || undefined);

      node = child;
    }

    return { fens, sans, comments, nags, numbers, shapes };
  } catch {
    return empty;
  }
}
