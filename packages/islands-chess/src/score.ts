import type { GameNode, GameTree } from './tree';
import { allNodes } from './tree';
import { extractShapes } from './shapes';

/**
 * The game score, grouped the way chess is written down (SPEC008 G2.1/G2.2).
 *
 * Printed chess books run the moves together and break for commentary, and
 * break again for a sideline: `1. e4 e5`, a paragraph about the centre, then
 * `2. Bc4 (2. Nf3 is the main line)`. This module produces that structure twice
 * over, from two different inputs:
 *
 * - {@link toScore} works from a parsed **tree**, for the interactive move
 *   list, which needs a path per move so a click can drive the board.
 * - {@link pgnScoreText} works from the **PGN text**, for the static fallback.
 *
 * The duplication is deliberate and was measured. The fallback runs at parse
 * time, in the module every reader loads, so parsing the game there would put
 * `chessops` in the main bundle for every book on the shelf — **+45.9 kB,
 * +13.2 kB gzipped**, verified by building it both ways. A fallback does not
 * need legal-move validation: a PGN already interleaves moves, commentary and
 * sidelines in reading order, so splitting on `{…}` reproduces the same blocks,
 * and keeps the author's own notation while it is at it.
 *
 * Pure and dependency-free either way.
 */

export interface ScoreMove {
  /** Position path this move leads to, i.e. what the board should show. */
  path: string;
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

export interface ScoreSegment {
  /** 0 is the main line; deeper is a sideline of a sideline. */
  depth: number;
  /** A note introducing this line, written before its first move. */
  startingComment?: string;
  blocks: ScoreBlock[];
}

export interface Score {
  /** A comment written before the first move: the game's introduction. */
  intro?: string;
  /** Lines in reading order: a sideline follows the move it replaces. */
  segments: ScoreSegment[];
}

/** `3. Qh5?!`, or `Start` for the initial position. */
export function moveLabel(node: GameNode | undefined): string {
  if (!node) return 'Start';
  return `${node.number} ${node.san}${node.nag ?? ''}`.trim();
}

/**
 * The position an author named in prose: `:move[2. Bc4]` → the path of that
 * move (SPEC001 §4.1).
 *
 * Matched on what a writer would actually type, which is not one fixed string:
 * `2. Bc4`, `2.Bc4` and `Bc4` all mean the same move, and the annotation glyph
 * is the annotator's, not the author's. The main line is searched first, so an
 * unqualified move means the obvious one; sidelines are reachable by writing
 * the number too.
 */
export function findByLabel(tree: GameTree, label: string): string | undefined {
  const wanted = normalise(label);
  if (!wanted) return undefined;

  const nodes = allNodes(tree);
  const match = (node: GameNode) =>
    normalise(`${node.number} ${node.san}`) === wanted || normalise(node.san) === wanted;

  // `allNodes` is depth-first from `children[0]`, so the main line comes first.
  return nodes.find(match)?.path;
}

/** Compare the way a reader would: no spaces, no glyphs, no case. */
function normalise(label: string): string {
  // Dots are kept: `1.` and `1...` are White's and Black's move one, and
  // collapsing them would make two different moves compare equal.
  return label.replace(/[+#!?\s]+/g, '').toLowerCase();
}

/**
 * Walks one line and everything that branches off it, in reading order.
 *
 * `nodes` is a sibling list: `nodes[0]` continues the line and `nodes[1..]` are
 * alternatives to it. An alternative interrupts the line at exactly the move it
 * replaces, which is where a printed book puts it, so the current segment is
 * closed and the line resumes in a new one afterwards.
 */
function lineSegments(nodes: GameNode[], depth: number): ScoreSegment[] {
  const out: ScoreSegment[] = [];
  let blocks: ScoreBlock[] = [];
  let moves: ScoreMove[] = [];
  let intro = nodes[0]?.startingComment;

  const flush = () => {
    if (moves.length > 0) {
      blocks.push({ moves });
      moves = [];
    }
    if (blocks.length > 0) {
      out.push({ depth, startingComment: intro, blocks });
      blocks = [];
      intro = undefined;
    }
  };

  let siblings = nodes;
  while (siblings.length > 0) {
    const node = siblings[0];
    moves.push({ path: node.path, number: node.number, san: `${node.san}${node.nag ?? ''}` });

    if (node.comment) {
      blocks.push({ moves, comment: node.comment });
      moves = [];
    }

    if (siblings.length > 1) {
      flush();
      for (const alternative of siblings.slice(1)) {
        out.push(...lineSegments([alternative], depth + 1));
      }
    }

    siblings = node.children;
  }

  flush();
  return out;
}

/** Groups a parsed game into lines punctuated by commentary. */
export function toScore(tree: GameTree): Score {
  return { intro: tree.comment, segments: lineSegments(tree.children, 0) };
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
 *
 * Sidelines need no special handling: they are parenthesised in the source and
 * stay parenthesised in the output, which is how a book prints them.
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
