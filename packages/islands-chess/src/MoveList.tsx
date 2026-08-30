import { useEffect, useRef } from 'react';
import type { GameTree } from './tree';
import { toScore } from './score';

export interface MoveListProps {
  /** The parsed game. */
  tree: GameTree;
  /** Path of the position currently on the board. */
  path: string;
  /** Jump the board to a position. */
  onSelect: (path: string) => void;
  /** `scroll` caps the height and keeps the current move in view. */
  scroll?: boolean;
}

/**
 * The game score as clickable text (SPEC008 G2.1), sidelines and all.
 *
 * Deliberately a component over *(game, path)* rather than markup inside the
 * board island: SPEC001 §4.1 wants a `::chess-moves` the author can place
 * anywhere inside a `:::chess-game`, and that should be a re-mount of this,
 * not a rewrite of it.
 *
 * The board's own buttons step one move at a time along the line you are on;
 * this is how a reader sees where they are, scans ahead, and steps into a
 * sideline — which the buttons alone cannot reach at all.
 */
export default function MoveList({ tree, path, onSelect, scroll = false }: MoveListProps) {
  const { intro, segments } = toScore(tree);
  const ref = useRef<HTMLDivElement>(null);

  // Only in `scroll` mode: the list has its own scrollport, and following the
  // reader inside it must not drag the page around.
  useEffect(() => {
    if (!scroll) return;
    ref.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [path, scroll]);

  return (
    <div
      ref={ref}
      className={`chess-moves${scroll ? ' chess-moves--scroll' : ''}`}
      data-testid="chess-move-list"
    >
      {intro && (
        <p
          className="chess-moves__comment"
          role={path === '' ? 'status' : undefined}
          data-testid={path === '' ? 'chess-comment' : undefined}
        >
          {intro}
        </p>
      )}

      {segments.map((segment, index) => (
        <div
          key={index}
          className={segment.depth > 0 ? 'chess-moves__line-group is-sideline' : undefined}
          // Nesting is meaning, not decoration: an indented run is an
          // alternative to the move above it, not a continuation of it.
          style={segment.depth > 0 ? { marginLeft: `${segment.depth}rem` } : undefined}
        >
          {segment.startingComment && (
            <p className="chess-moves__comment">{segment.startingComment}</p>
          )}
          {segment.blocks.map((block, blockIndex) => {
            // A block's comment describes the position after its last move, so
            // it is "the current annotation" exactly when the reader is there.
            // That is the one that gets the live region, and the testid the
            // board's standalone comment uses when the list is off.
            const current = block.moves[block.moves.length - 1]?.path === path;
            return (
              <div key={blockIndex}>
                <p className="chess-moves__line">
                  {block.moves.map((move) => (
                    <button
                      key={move.path}
                      type="button"
                      className="chess-moves__move"
                      // `aria-current` rather than a disabled or pressed
                      // button: the move you are on is still a place you can
                      // navigate to.
                      aria-current={move.path === path ? 'true' : undefined}
                      onClick={() => onSelect(move.path)}
                    >
                      {move.number} {move.san}
                    </button>
                  ))}
                </p>
                {block.comment && (
                  <p
                    className="chess-moves__comment"
                    role={current ? 'status' : undefined}
                    data-testid={current ? 'chess-comment' : undefined}
                  >
                    {block.comment}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
