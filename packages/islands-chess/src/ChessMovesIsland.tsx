import { attrFlag, type IslandComponentProps } from '@smart-ebooks/engine';
import MoveList from './MoveList';
import { useGame, useSequence } from './gameContext';
import './chess.css';

/**
 * The game score, placed where the author wants it (SPEC001 §4.1, SPEC008 G4.2).
 *
 * Exactly the move list a standalone `chess-board` can show, re-mounted as its
 * own island — which is why `MoveList` was written as a component over
 * *(game, position)* rather than as markup inside the board. This file is the
 * proof that decision paid: it is a wrapper, not a reimplementation.
 */
export default function ChessMovesIsland({ attributes }: IslandComponentProps) {
  const game = useGame();
  const sequence = useSequence();

  if (!game || !sequence) {
    return (
      <div className="island island--unknown" role="note">
        A <code>chess-moves</code> has to be inside a <code>chess-game</code>.
      </div>
    );
  }

  // Distinct from the message above, because it is a different mistake on a
  // different line: the board is where the author put it, and the game it is
  // in has nothing to show.
  if (game.tree.children.length === 0) {
    return (
      <div className="island island--unknown" role="note">
        This <code>chess-game</code> has no moves to show. Give it a <code>pgn</code> code block or
        a <code>pgn=&quot;assets/…&quot;</code> file.
      </div>
    );
  }

  return (
    <MoveList
      tree={game.tree}
      path={sequence.current}
      onSelect={sequence.go}
      scroll={attrFlag(attributes.scroll, true)}
    />
  );
}
