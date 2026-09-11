/**
 * The parts of a chess game a directive can name, resolved in plain Node.
 *
 * Extracted from `check-games.mjs` so both the checker **and a parity test**
 * can reach them. These functions mirror `packages/islands-chess/src/score.ts`
 * — `findByLabel`, `findByFen` and `positionKey` — and are duplicated rather
 * than imported for the reason the island contract is duplicated: these scripts
 * are plain `.mjs` and cannot load the engine's TypeScript.
 *
 * **A mirror with no parity test is a mirror that drifts.** That is what the
 * island contract taught (SPEC008 §4.19: `lint-islands.mjs` reads the JSON, so
 * every lint test passes against code that disagrees with it). The same trap
 * was open here and wider: nothing compared these to `score.ts` at all, so a
 * change to how the reader matches a label would leave the checker happily
 * validating against the old rules. `labelParity.test.ts` is the join.
 */
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';

/**
 * Compare labels the way `score.ts` does: no spaces, no glyphs, no case.
 *
 * Dots are kept: `1.` and `1...` are White's and Black's move one, and
 * collapsing them would make two different moves compare equal.
 */
export function normalise(label) {
  return label.replace(/[+#!?\s]+/g, '').toLowerCase();
}

/**
 * Every form of every move a `:move[…]` or an `at="…"` could name.
 *
 * Mirrors `findByLabel`, which matches either `"<number> <san>"` or the bare
 * SAN — so `2. Bc4`, `2.Bc4` and `Bc4` all name the same move. If the two ever
 * disagree, this reports a mark as broken that the reader can click, which is
 * the safe direction to be wrong in.
 */
export function labelsOf(pgn) {
  const game = parsePgn(pgn)[0];
  const found = new Set();
  if (!game) return found;

  const walk = (node, position) => {
    for (const child of node.children) {
      const move = parseSan(position, child.data.san);
      if (!move) continue; // Reported by `plies`, which replays the same tree.
      const after = position.clone();

      // Read the number *before* playing, as `tree.ts` does: that is whose move it is.
      const number = after.turn === 'white' ? `${after.fullmoves}.` : `${after.fullmoves}...`;
      after.play(move);

      found.add(normalise(`${number} ${child.data.san}`));
      found.add(normalise(child.data.san));

      walk(child, after);
    }
  };

  walk(game.moves, startingPosition(game.headers).unwrap());
  return found;
}

/** The first four FEN fields, which are what identifies a position. */
export function positionKey(fen) {
  const [placement = '', turn = '', castling = '-', enPassant = '-'] = fen.trim().split(/\s+/);
  return [placement, turn, castling, enPassant].join(' ');
}

/**
 * Every position the game reaches, keyed the way `findByFen` compares them.
 *
 * Mirrors `positionKey`: placement, side to move, castling rights and the
 * en-passant square, and **not** the two clocks. A diagram is a position, not a
 * move count, so a FEN copied from one source and a game replayed from another
 * must still compare equal.
 *
 * The starting position counts. `findByFen` checks `tree.fen` before walking
 * the nodes, so a diagram of the initial array is a legitimate tap target.
 */
export function positionsOf(pgn) {
  const game = parsePgn(pgn)[0];
  const found = new Set();
  if (!game) return found;

  const root = startingPosition(game.headers).unwrap();
  found.add(positionKey(makeFen(root.toSetup())));

  const walk = (node, position) => {
    for (const child of node.children) {
      const move = parseSan(position, child.data.san);
      if (!move) continue;
      const after = position.clone();
      after.play(move);
      found.add(positionKey(makeFen(after.toSetup())));
      walk(child, after);
    }
  };

  walk(game.moves, root);
  return found;
}
