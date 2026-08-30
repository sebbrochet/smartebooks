import { parsePgn, startingPosition } from 'chessops/pgn';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';

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

/** Join a move's comments; PGN allows several in a row. */
function text(comments: string[] | undefined): string | undefined {
  const joined = (comments ?? []).map((comment) => comment.trim()).filter(Boolean);
  return joined.length > 0 ? joined.join(' ') : undefined;
}

/**
 * Replay a PGN's mainline into a FEN-per-ply list (plus SAN labels). Pure and
 * dependency-light enough to run at parse time or in the board island.
 *
 * Annotations are kept, not discarded: a PGN's `{…}` comments are the reason
 * annotated games are worth reading, and chessops already parses them.
 */
export function pgnToPlies(pgn: string): PgnPlies {
  const empty: PgnPlies = { fens: [], sans: [], comments: [], nags: [], numbers: [] };

  try {
    const game = parsePgn(pgn)[0];
    if (!game) return empty;

    const pos = startingPosition(game.headers).unwrap();
    const fens = [makeFen(pos.toSetup())];
    const sans: string[] = [];
    const comments: (string | undefined)[] = [];
    const nags: (string | undefined)[] = [];
    const numbers: string[] = [];

    // A comment before the first move is a *game* comment in PGN, not a
    // property of the first move — chessops keeps it on the game. It describes
    // the starting position, which is ply 0.
    comments.push(text(game.comments));

    let node = game.moves;
    while (node.children.length > 0) {
      const child = node.children[0];
      const move = parseSan(pos, child.data.san);
      if (!move) break;

      // Read the number *before* playing: that is whose move it is.
      numbers.push(pos.turn === 'white' ? `${pos.fullmoves}.` : `${pos.fullmoves}...`);
      pos.play(move);

      sans.push(child.data.san);
      fens.push(makeFen(pos.toSetup()));
      comments.push(text(child.data.comments));
      nags.push(child.data.nags?.map((nag) => NAGS[nag] ?? '').join('') || undefined);

      node = child;
    }

    return { fens, sans, comments, nags, numbers };
  } catch {
    return empty;
  }
}
