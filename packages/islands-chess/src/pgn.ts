import { parsePgn, startingPosition } from 'chessops/pgn';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';

export interface PgnPlies {
  /** FEN after each ply, index 0 = starting position. */
  fens: string[];
  /** SAN of each played move (fens.length === sans.length + 1). */
  sans: string[];
}

/**
 * Replay a PGN's mainline into a FEN-per-ply list (plus SAN labels). Pure and
 * dependency-light enough to run at parse time or in the board island.
 */
export function pgnToPlies(pgn: string): PgnPlies {
  try {
    const game = parsePgn(pgn)[0];
    if (!game) return { fens: [], sans: [] };

    const pos = startingPosition(game.headers).unwrap();
    const fens = [makeFen(pos.toSetup())];
    const sans: string[] = [];

    let node = game.moves;
    while (node.children.length > 0) {
      const child = node.children[0];
      const move = parseSan(pos, child.data.san);
      if (!move) break;
      pos.play(move);
      sans.push(child.data.san);
      fens.push(makeFen(pos.toSetup()));
      node = child;
    }
    return { fens, sans };
  } catch {
    return { fens: [], sans: [] };
  }
}
