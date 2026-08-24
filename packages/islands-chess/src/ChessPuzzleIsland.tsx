import { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import { usePersistentState, type IslandComponentProps } from '@smart-ebooks/engine';
import { DEFAULT_BOARD_OPTIONS, type BoardOptions } from './boardOptions';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './chess.css';
import './themes.css';

/**
 * A "think, then reveal" chess puzzle: shows a position (FEN), lets the reader
 * reveal the solution and self-mark it solved (persisted per book). Shares the
 * board's `theme`/`pieces` config.
 */
export default function ChessPuzzleIsland({ id, data }: IslandComponentProps) {
  const {
    fen,
    solution,
    board = DEFAULT_BOARD_OPTIONS,
  } = (data as { fen?: string; solution?: string; board?: BoardOptions }) ?? {};
  const { theme, pieces } = board;
  const boardRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [state, setState] = usePersistentState<{ solved: boolean }>(`chesspuzzle:${id}`, {
    solved: false,
  });

  useEffect(() => {
    if (!boardRef.current || !fen) return;
    const api = Chessground(boardRef.current, { viewOnly: true, coordinates: true, fen });
    return () => api.destroy();
  }, [fen]);

  if (!fen) {
    return (
      <div className="island island--unknown" role="note">
        Puzzle is missing a <code>fen</code>.
      </div>
    );
  }

  return (
    <div className={`island chessboard-island ${state.solved ? 'is-solved' : ''}`}>
      <div
        className={`chessboard-island__board cg-wrap cg-theme--${theme} cg-pieces--${pieces}`}
        ref={boardRef}
        aria-label="Chess puzzle"
      />
      <div className="chessboard-island__controls">
        <button type="button" onClick={() => setRevealed((value) => !value)}>
          {revealed ? 'Hide solution' : 'Reveal solution'}
        </button>
        <label className="chesspuzzle__solved">
          <input
            type="checkbox"
            checked={state.solved}
            onChange={(event) => setState({ solved: event.target.checked })}
          />{' '}
          Solved
        </label>
      </div>
      {revealed && solution && <p className="chesspuzzle__solution">{solution}</p>}
    </div>
  );
}
