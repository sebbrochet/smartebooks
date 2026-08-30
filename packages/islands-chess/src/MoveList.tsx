import { useEffect, useRef } from 'react';
import type { PgnPlies } from './pgn';
import { toScore } from './score';

export interface MoveListProps {
  /** The replayed game. */
  plies: PgnPlies;
  /** The ply currently on the board. */
  ply: number;
  /** Jump the board to a ply. */
  onSelect: (ply: number) => void;
  /** `scroll` caps the height and keeps the current move in view. */
  scroll?: boolean;
}

/**
 * The game score as clickable text (SPEC008 G2.1).
 *
 * Deliberately a component over *(game, ply)* rather than markup inside the
 * board island: SPEC001 §4.1 wants a `::chess-moves` the author can place
 * anywhere inside a `:::chess-game`, and that should be a re-mount of this,
 * not a rewrite of it.
 *
 * The board's own buttons step one ply at a time; this is how a reader sees
 * where they are, scans ahead, and jumps.
 */
export default function MoveList({ plies, ply, onSelect, scroll = false }: MoveListProps) {
  const { intro, blocks } = toScore(plies);
  const ref = useRef<HTMLDivElement>(null);

  // Only in `scroll` mode: the list has its own scrollport, and following the
  // reader inside it must not drag the page around.
  useEffect(() => {
    if (!scroll) return;
    ref.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [ply, scroll]);

  return (
    <div
      ref={ref}
      className={`chess-moves${scroll ? ' chess-moves--scroll' : ''}`}
      data-testid="chess-move-list"
    >
      {intro && (
        <p
          className="chess-moves__comment"
          role={ply === 0 ? 'status' : undefined}
          data-testid={ply === 0 ? 'chess-comment' : undefined}
        >
          {intro}
        </p>
      )}

      {blocks.map((block, index) => {
        // A block's comment describes the position after its last move, so it
        // is "the current annotation" exactly when the reader is on that ply.
        // That is the one that gets the live region, and the testid the board's
        // standalone comment uses when the list is off.
        const current = block.moves[block.moves.length - 1]?.ply === ply;
        return (
          <div key={index}>
            <p className="chess-moves__line">
              {block.moves.map((move) => (
                <button
                  key={move.ply}
                  type="button"
                  className="chess-moves__move"
                  // `aria-current` rather than a disabled or pressed button:
                  // the move you are on is still a place you can navigate to.
                  aria-current={move.ply === ply ? 'true' : undefined}
                  onClick={() => onSelect(move.ply)}
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
  );
}
