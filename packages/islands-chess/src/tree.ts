import { parsePgn, startingPosition, type PgnNodeData, type ChildNode } from 'chessops/pgn';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import type { Position } from 'chessops/chess';
import { extractShapes, type MoveShape } from './shapes';

/**
 * A PGN read as the **tree** it actually is (SPEC008 G3.1).
 *
 * Annotated chess is written with sidelines: `1. e4 e5 (1... d5 2. exd5) 2. Nf3`.
 * A flat array of positions cannot hold them, so the pack used to drop every
 * one in silence. A tree can, and — verified against the parser rather than
 * assumed (SPEC008 QC4) — `chessops/pgn` already returns one: `children[0]` is
 * the continuation, `children[1..]` are the sidelines, with comments, glyphs
 * and a variation's own introduction each on the right node.
 *
 * Positions are addressed by **path**, not by index: `"0.1.0"` is
 * child 0, then its second child, then that one's first. An index into a list
 * cannot name a move inside a sideline, which is the whole reason C5 had to be
 * fixed before anything else was built on top of it.
 */

/** Numeric Annotation Glyphs, as chess writing spells them.
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

export interface GameNode {
  /** Position path from the start, e.g. `0.1.0`. `''` is the starting position. */
  path: string;
  /** Move number prefix: `1.` for White, `1...` for Black. */
  number: string;
  /** SAN as written, without any glyph. */
  san: string;
  /** Annotation glyph(s) attached to this move, already in symbol form. */
  nag?: string;
  /** FEN of the position *after* this move. */
  fen: string;
  /** The annotator's note on the position after this move. */
  comment?: string;
  /** A note introducing this line, written before its first move. */
  startingComment?: string;
  /** Arrows and highlights for the position after this move. */
  shapes: MoveShape[];
  /**
   * `children[0]` continues this line; `children[1..]` are sidelines from the
   * same position. Empty at the end of a line.
   */
  children: GameNode[];
}

export interface GameTree {
  /** FEN of the starting position — not always the initial array. */
  fen: string;
  /** A comment written before the first move: the game's introduction. */
  comment?: string;
  /** Shapes drawn on the starting position. */
  shapes: MoveShape[];
  /** First moves. More than one means the game opens with a sideline. */
  children: GameNode[];
}

const EMPTY: GameTree = { fen: '', comment: undefined, shapes: [], children: [] };

/** Join a node's comments (PGN allows several) and split the shapes out. */
function annotate(comments: string[] | undefined): { text?: string; shapes: MoveShape[] } {
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
 * Reads a PGN's first game into a tree of positions.
 *
 * Every branch is replayed on its own copy of the position, which is what makes
 * sidelines possible at all: a sideline continues from the position *before*
 * its parent move, not after it. An illegal move ends that line and leaves the
 * rest of the game alone — a reader loses one variation, not the page.
 */
export function pgnToTree(pgn: string): GameTree {
  try {
    const game = parsePgn(pgn)[0];
    if (!game) return EMPTY;

    const root = startingPosition(game.headers).unwrap();
    const opening = annotate(game.comments);

    return {
      fen: makeFen(root.toSetup()),
      comment: opening.text,
      shapes: opening.shapes,
      children: branches(game.moves.children, root, ''),
    };
  } catch {
    return EMPTY;
  }
}

/** Builds the sibling moves playable from `before`, each with its own subtree. */
function branches(
  children: ChildNode<PgnNodeData>[],
  before: Position,
  parentPath: string,
): GameNode[] {
  const out: GameNode[] = [];

  for (const child of children) {
    const move = parseSan(before, child.data.san);
    if (!move) continue;

    // Each sibling starts from the same position, so it needs its own copy.
    const after = before.clone();
    // Read the number before playing: that is whose move it is.
    const number = after.turn === 'white' ? `${after.fullmoves}.` : `${after.fullmoves}...`;
    after.play(move);

    const annotated = annotate(child.data.comments);
    const path = parentPath === '' ? `${out.length}` : `${parentPath}.${out.length}`;

    out.push({
      path,
      number,
      san: child.data.san,
      nag: child.data.nags?.map((nag) => NAGS[nag] ?? '').join('') || undefined,
      fen: makeFen(after.toSetup()),
      comment: annotated.text,
      startingComment: annotate(child.data.startingComments).text,
      shapes: annotated.shapes,
      children: branches(child.children, after, path),
    });
  }

  return out;
}

/** The main line: `children[0]` all the way down. */
export function mainline(tree: GameTree): GameNode[] {
  const line: GameNode[] = [];
  let node = tree.children[0];
  while (node) {
    line.push(node);
    node = node.children[0];
  }
  return line;
}

/** Every node in the game, main line and sidelines, in reading order. */
export function allNodes(tree: GameTree): GameNode[] {
  const out: GameNode[] = [];
  const visit = (nodes: GameNode[]) => {
    for (const node of nodes) {
      out.push(node);
      visit(node.children);
    }
  };
  visit(tree.children);
  return out;
}

/** The node at `path`, or `undefined` — including for the starting position. */
export function nodeAt(tree: GameTree, path: string): GameNode | undefined {
  if (!path) return undefined;

  let nodes = tree.children;
  let found: GameNode | undefined;
  for (const step of path.split('.')) {
    found = nodes[Number(step)];
    if (!found) return undefined;
    nodes = found.children;
  }
  return found;
}

/** The path one move back from `path`, or `''` for the starting position. */
export function parentPath(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(0, dot);
}

/**
 * The path of the *n*th move of the main line, for `n >= 1`.
 *
 * This is also the migration for readers who saved a position before paths
 * existed: their stored ply is a main-line move count, and it still means the
 * same square of the same game.
 */
export function mainlinePath(tree: GameTree, ply: number): string {
  if (ply <= 0 || tree.children.length === 0) return '';
  const line = mainline(tree);
  return line[Math.min(ply, line.length) - 1]?.path ?? '';
}
