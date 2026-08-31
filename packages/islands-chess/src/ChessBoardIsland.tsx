import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import {
  attrFlag,
  attrText,
  usePersistentState,
  type IslandComponentProps,
} from '@smart-ebooks/engine';
import { mainlinePath, nodeAt, parentPath, pgnToTree } from './tree';
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
 * (Chessground); the position is persisted per book. Visual options
 * (`theme`, `pieces`, `orientation`) are resolved and validated at parse time.
 * With `analysis=on`, an on-demand Stockfish evaluation of the current position
 * is offered below the board; with `moves`, the whole score is shown.
 *
 * The game comes from the directive body, or from a packaged `.pgn` file named
 * by the `pgn` attribute, which wins when both are present.
 */
export default function ChessBoardIsland({
  id,
  attributes,
  packagedAssets,
  data,
}: IslandComponentProps) {
  const parsed = (data as { pgn?: string; board?: BoardOptions }) ?? {};
  const body = parsed.pgn ?? '';
  const { theme, pieces, orientation } = parsed.board ?? DEFAULT_BOARD_OPTIONS;
  const analysisOn = attrFlag(attributes.analysis);
  const shapesOn = attrFlag(attributes.shapes, true);
  const movesMode = attrText(attributes.moves, 'off');

  // Only a *packaged* file is read. `IslandHost` resolves `assets/…` values and
  // reports which attributes it resolved; anything else — an absolute URL in an
  // imported book, say — is left alone, and fetching it would let a book pull
  // arbitrary content from the network on the reader's behalf.
  const assetUrl = packagedAssets.includes('pgn') ? attrText(attributes.pgn) : '';
  const [fromFile, setFromFile] = useState<string | null>(null);

  useEffect(() => {
    if (!assetUrl) return;
    let cancelled = false;
    fetch(assetUrl)
      .then((response) => response.text())
      // An empty string, not null: the difference is "still loading" versus
      // "loaded, and there is no game in it".
      .then((text) => !cancelled && setFromFile(text))
      .catch(() => !cancelled && setFromFile(''));
    return () => {
      cancelled = true;
    };
  }, [assetUrl]);

  const loading = assetUrl !== '' && fromFile === null;
  const source = assetUrl ? (fromFile ?? '') : body;
  const tree = useMemo(() => pgnToTree(source), [source]);
  const [stored, setStored] = usePersistentState<string | number>(`chessply:${id}`, '');
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  // Positions used to be addressed by ply, and readers have that number saved.
  // It still names the same move of the same game, so it is migrated rather
  // than discarded — losing someone's place in a book is not an upgrade.
  const requested = typeof stored === 'number' ? mainlinePath(tree, stored) : stored;
  // A path from a position that no longer exists — an edited game, a deleted
  // sideline — must land somewhere real rather than blank the board.
  const path = requested && nodeAt(tree, requested) ? requested : '';
  const node = nodeAt(tree, path);

  const fen = node?.fen ?? tree.fen;
  const shapes = node?.shapes ?? tree.shapes;
  const comment = node?.comment ?? (path === '' ? tree.comment : undefined);

  // `auto` is read from the starting position, not the current one: resolving
  // it per move would spin the board round every time Black plays.
  const side = orientationFor(orientation, tree.fen);

  // Navigation follows the line the reader is on, not the main line: stepping
  // forward inside a sideline must stay inside it.
  const next = (node ? node.children[0] : tree.children[0])?.path;
  const previous = node ? parentPath(node.path) : undefined;
  const endOfLine = () => {
    let last = node ?? tree.children[0];
    while (last?.children[0]) last = last.children[0];
    return last?.path ?? '';
  };

  function onKeyDown(event: React.KeyboardEvent) {
    const to: string | undefined = {
      ArrowLeft: previous,
      ArrowRight: next,
      Home: '',
      End: endOfLine(),
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    setStored(to);
  }

  useEffect(() => {
    if (!boardRef.current || !tree.fen) return;
    const api = Chessground(boardRef.current, {
      viewOnly: true,
      coordinates: true,
      fen: tree.fen,
      orientation: side,
      // The reader may not draw, but the annotator's shapes must still render.
      drawable: { enabled: false, visible: true },
    });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [tree, side]);

  useEffect(() => {
    if (!fen) return;
    apiRef.current?.set({ fen });
    // Set unconditionally, including to `[]`: shapes belong to a position, and
    // leaving the previous move's arrows up would annotate the wrong move.
    apiRef.current?.setShapes(shapesOn ? shapes : []);
  }, [fen, shapes, shapesOn]);

  if (tree.children.length === 0) {
    return loading ? (
      <div className="island island--loading" aria-busy="true" />
    ) : (
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
            onClick={() => setStored('')}
            disabled={path === ''}
          >
            ⏮
          </button>
          <button
            type="button"
            aria-label="Previous move"
            onClick={() => setStored(previous ?? '')}
            disabled={previous === undefined}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Next move"
            onClick={() => setStored(next ?? path)}
            disabled={next === undefined}
          >
            ▶
          </button>
          <button
            type="button"
            aria-label="Last move"
            onClick={() => setStored(endOfLine())}
            disabled={next === undefined}
          >
            ⏭
          </button>
        </div>
        <span className="chessboard-island__status" data-testid="chess-move">
          {moveLabel(node)}
        </span>
      </div>
      {movesMode !== 'off' && (
        <MoveList tree={tree} path={path} onSelect={setStored} scroll={movesMode === 'scroll'} />
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
