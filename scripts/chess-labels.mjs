/**
 * The parts of a chess game a directive can name, resolved in plain Node.
 *
 * Extracted from `check-games.mjs` so both the checker **and a parity test**
 * can reach them. These functions mirror `packages/islands-chess/src/score.ts`
 * — `findByLabel`, `findByFen` and `positionKey`. Tree construction is mirrored
 * because these scripts are plain `.mjs`; move-reference matching is shared
 * with the reader through the dependency-free `moveReference.mjs`.
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
import { normalise, resolveMoveReference } from '../packages/islands-chess/src/moveReference.mjs';
export { normalise } from '../packages/islands-chess/src/moveReference.mjs';

/**
 * Adapt the checker's candidate index to the shared explicit-line resolver.
 * A target appears under both its numbered and bare labels; visit it once.
 */
export function resolveLabelReference(targets, label, line) {
  const nodes = new Map();
  for (const candidates of targets.values()) {
    for (const target of candidates) {
      if (nodes.has(target.path)) continue;
      const last = target.line[target.line.length - 1];
      const space = last.indexOf(' ');
      nodes.set(target.path, {
        path: target.path,
        number: last.slice(0, space),
        san: last.slice(space + 1),
      });
    }
  }
  return resolveMoveReference([...nodes.values()], label, line);
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
  return new Set(labelTargetsOf(pgn).keys());
}

/**
 * Candidate moves for each normalized label, in the reader's search order.
 * Keep their paths, positions and full lines so an ambiguity diagnostic can
 * name the selected variation even when its immediate predecessor is repeated.
 */
export function labelTargetsOf(pgn) {
  const game = parsePgn(pgn)[0];
  /** @type {Map<string, {path: string, fen: string, mainline: boolean, line: string[]}[]>} */
  const found = new Map();
  if (!game) return found;

  const walk = (node, position, parentPath, line, mainline) => {
    let index = 0;
    for (const child of node.children) {
      const move = parseSan(position, child.data.san);
      if (!move) continue; // Reported by `plies`, which replays the same tree.
      const after = position.clone();

      const number = after.turn === 'white' ? `${after.fullmoves}.` : `${after.fullmoves}...`;
      after.play(move);

      // `tree.ts` numbers only playable children, not illegal moves it skips.
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      const target = {
        path,
        fen: makeFen(after.toSetup()),
        mainline: mainline && index === 0,
        line: [...line, `${number} ${child.data.san}`],
      };
      index++;

      for (const label of [normalise(`${number} ${child.data.san}`), normalise(child.data.san)]) {
        if (!found.has(label)) found.set(label, []);
        found.get(label).push(target);
      }

      walk(child, after, path, target.line, target.mainline);
    }
  };

  walk(game.moves, startingPosition(game.headers).unwrap(), '', [], true);
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
