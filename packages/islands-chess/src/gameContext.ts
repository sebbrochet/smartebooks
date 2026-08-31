import { createContext, useContext } from 'react';
import { createSequence } from '@smart-ebooks/engine';
import type { BoardOptions } from './boardOptions';
import type { GameTree } from './tree';

/**
 * The chess pack's own coordination context (SPEC001 P2.10b, §4.1).
 *
 * `:::chess-game` publishes the game and the position on it; `::chess-board`,
 * `::chess-moves` and `:move` consume them. The engine mediates none of this —
 * it only stopped flattening the tree, so a container can render its children
 * and reach them through a context **it owns**.
 *
 * Two contexts, deliberately. The *position* is the engine's shared sequence
 * primitive, because chess plies, music timestamps and comic panels are the
 * same shape. The *game* is pack-specific and rides alongside, because nothing
 * outside chess has any use for a move tree.
 */
export const { SequenceProvider, useSequence } = createSequence('ChessGame');

export interface ChessGame {
  tree: GameTree;
  /** Resolved once by the container, so children need not resolve them again. */
  board: BoardOptions;
  /** Draw the annotator's arrows, unless the author turned them off. */
  shapes: boolean;
}

const GameContext = createContext<ChessGame | undefined>(undefined);

export const GameProvider = GameContext.Provider;

/** The game a child island is inside, or `undefined` if it stands alone. */
export function useGame(): ChessGame | undefined {
  return useContext(GameContext);
}
