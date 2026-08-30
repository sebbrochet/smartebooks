import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import {
  attrFlag,
  attrText,
  usePersistentState,
  type IslandComponentProps,
} from '@smart-ebooks/engine';
import { pgnToPlies } from './pgn';
import { moveLabel } from './score';
import MoveList from './MoveList';
import { DEFAULT_BOARD_OPTIONS, orientationFor, type BoardOptions } from './boardOptions';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './chess.css';
import './themes.css';

// Loaded only when a board opts into analysis, so the Stockfish client stays
// out of the board chunk for books that never use it.
const PositionAnalysis = lazy(() => import('./PositionAnalysis'));

/**
 * Displays a chess game from PGN with move navigation. Read-only board
 * (Chessground); the current ply is persisted per book. Visual options
 * (`theme`, `pieces`, `orientation`) are resolved and validated at parse time.
 * With `analysis=on`, an on-demand Stockfish evaluation of the current position
 * is offered below the board.
 */
export default function ChessBoardIsland({ id, attributes, data }: IslandComponentProps) {
  const parsed = (data as { pgn?: string; board?: BoardOptions }) ?? {};
  const pgn = parsed.pgn ?? '';
  const { theme, pieces, orientation } = parsed.board ?? DEFAULT_BOARD_OPTIONS;
  const analysisOn = attrFlag(attributes.analysis);
  const shapesOn = attrFlag(attributes.shapes, true);
  const movesMode = attrText(attributes.moves, 'off');
  const plies = useMemo(() => pgnToPlies(pgn), [pgn]);
  const { fens, comments, shapes } = plies;
  const [ply, setPly] = usePersistentState<number>(`chessply:${id}`, 0);
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  const lastPly = Math.max(fens.length - 1, 0);
  const clampedPly = Math.max(0, Math.min(ply, lastPly));
  const fen = fens[clampedPly];

  // `auto` is read from the starting position, not the current one: resolving
  // it per ply would spin the board round every time Black moves.
  const side = orientationFor(orientation, fens[0]);

  // The annotator's note about the position on the board. Indexed by ply, so
  // index 0 is whatever was written before the first move.
  const comment = comments[clampedPly];
  const move = moveLabel(plies, clampedPly);

  // Arrow keys are how anyone reads a game; four buttons and a mouse are not.
  // Bound to the board itself, so a reader who tabs to it can step without
  // reaching for the controls (SPEC008 G2.4).
  function onKeyDown(event: React.KeyboardEvent) {
    const to = {
      ArrowLeft: clampedPly - 1,
      ArrowRight: clampedPly + 1,
      Home: 0,
      End: lastPly,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    setPly(Math.max(0, Math.min(to, lastPly)));
  }

  useEffect(() => {
    if (!boardRef.current || fens.length === 0) return;
    const api = Chessground(boardRef.current, {
      viewOnly: true,
      coordinates: true,
      fen: fens[0],
      orientation: side,
      // The reader may not draw, but the annotator's shapes must still render.
      drawable: { enabled: false, visible: true },
    });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [fens, side]);

  useEffect(() => {
    if (!fen) return;
    apiRef.current?.set({ fen });
    // Set unconditionally, including to `[]`: shapes belong to a position, and
    // leaving the previous ply's arrows up would annotate the wrong move.
    apiRef.current?.setShapes(shapesOn ? (shapes[clampedPly] ?? []) : []);
  }, [fen, shapes, shapesOn, clampedPly]);

  if (fens.length === 0) {
    return (
      <div className="island island--unknown" role="note">
        No valid PGN to display.
      </div>
    );
  }

  return (
    <div className="island chessboard-island">
      <div
        className={`chessboard-island__board cg-wrap cg-theme--${theme} cg-pieces--${pieces}`}
        ref={boardRef}
        tabIndex={0}
        role="group"
        aria-label="Chess board — arrow keys step through the game"
        onKeyDown={onKeyDown}
      />
      <div className="chessboard-island__controls">
        <div className="chessboard-island__buttons" role="group" aria-label="Move navigation">
          <button
            type="button"
            aria-label="First move"
            onClick={() => setPly(0)}
            disabled={clampedPly === 0}
          >
            ⏮
          </button>
          <button
            type="button"
            aria-label="Previous move"
            onClick={() => setPly(clampedPly - 1)}
            disabled={clampedPly === 0}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Next move"
            onClick={() => setPly(clampedPly + 1)}
            disabled={clampedPly >= lastPly}
          >
            ▶
          </button>
          <button
            type="button"
            aria-label="Last move"
            onClick={() => setPly(lastPly)}
            disabled={clampedPly >= lastPly}
          >
            ⏭
          </button>
        </div>
        <span className="chessboard-island__status" data-testid="chess-move">
          {move}
        </span>
      </div>
      {movesMode !== 'off' && (
        <MoveList
          plies={plies}
          ply={clampedPly}
          onSelect={setPly}
          scroll={movesMode === 'scroll'}
        />
      )}
      {movesMode === 'off' && comment && (
        // `role="status"` because stepping through a game changes this text
        // without moving focus — a screen-reader user would otherwise never
        // hear the annotation they are navigating to. With the move list on,
        // that job moves into the list, which already shows every comment;
        // rendering both would print the same sentence twice.
        <p className="chessboard-island__comment" role="status" data-testid="chess-comment">
          {comment}
        </p>
      )}
      {analysisOn && fen && (
        <div className="chessboard-island__analysis">
          <Suspense fallback={<div className="island island--loading" aria-busy="true" />}>
            <PositionAnalysis fen={fen} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
