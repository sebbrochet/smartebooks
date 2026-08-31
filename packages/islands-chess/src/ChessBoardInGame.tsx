import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { attrFlag, attrText, type IslandComponentProps } from '@smart-ebooks/engine';
import { orientationFor } from './boardOptions';
import { findByLabel, moveLabel } from './score';
import { nodeAt, parentPath } from './tree';
import { useGame, useSequence } from './gameContext';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './chess.css';
import './themes.css';

// Same lazy import the standalone board uses, so a game with no `analysis`
// anywhere in it never pulls the Stockfish client.
const PositionAnalysis = lazy(() => import('./PositionAnalysis'));

/**
 * A board **inside** a `:::chess-game` (SPEC001 §4.1, SPEC008 G4.1).
 *
 * It owns no game and no position: both come from the container, so several
 * boards in one chapter stay in step and a `:move` in the prose drives them
 * all. Zero, one or a dozen are fine.
 *
 * `at` pins a board to a fixed position and takes its controls away — that is
 * the printed diagram, which stays put while the interactive board follows the
 * reader.
 *
 * Everything else a standalone board does, it does. `analysis` is per board
 * rather than per game on purpose: a chapter may want the engine under the
 * board at the critical moment and nowhere else.
 */
export default function ChessBoardInGame({ attributes }: IslandComponentProps) {
  const game = useGame();
  const sequence = useSequence();
  const at = attrText(attributes.at);
  const analysisOn = attrFlag(attributes.analysis);

  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  const tree = game?.tree;
  // SPEC001 §4.1 sketched `at="4"`. A bare number is ambiguous — ply four or
  // move four? — and cannot name a position in a sideline at all, so `at` takes
  // the same move label `:move[…]` takes: `at="4. Qxf7#"`. One way to name a
  // position in this pack, not two.
  const pinned = tree && at ? (findByLabel(tree, at) ?? '') : '';
  const path = pinned || sequence?.current || '';
  const node = tree ? nodeAt(tree, path) : undefined;
  const fen = node?.fen ?? tree?.fen ?? '';
  // A fresh array every render would re-run the effect below every render, and
  // `setShapes` on a Chessground instance is not free.
  const shapes = useMemo(
    () => (game?.shapes ? (node?.shapes ?? tree?.shapes ?? []) : []),
    [game?.shapes, node, tree],
  );
  const side = orientationFor(game?.board.orientation, tree?.fen);

  useEffect(() => {
    if (!boardRef.current || !tree?.fen) return;
    const api = Chessground(boardRef.current, {
      viewOnly: true,
      coordinates: true,
      fen: tree.fen,
      orientation: side,
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
    apiRef.current?.setShapes(shapes);
  }, [fen, shapes]);

  if (!game || !sequence) {
    return (
      <div className="island island--unknown" role="note">
        A <code>chess-board</code> with no game of its own has to be inside a{' '}
        <code>chess-game</code>.
      </div>
    );
  }

  // Three different mistakes used to share one message, and it named the wrong
  // one: a `chess-game` whose PGN was missing or unparseable told the author
  // their board was in the wrong place, which sent them to the wrong line.
  if (!tree || tree.children.length === 0) {
    return (
      <div className="island island--unknown" role="note">
        This <code>chess-game</code> has no moves to show. Give it a <code>pgn</code> code block or
        a <code>pgn=&quot;assets/…&quot;</code> file.
      </div>
    );
  }

  const previous = node ? parentPath(node.path) : undefined;
  const next = (node ? node.children[0] : tree.children[0])?.path;
  const endOfLine = () => {
    let last = node ?? tree.children[0];
    while (last?.children[0]) last = last.children[0];
    return last?.path ?? '';
  };

  // The same keys a standalone board answers to. Losing them in the newer
  // authoring form would be an accessibility regression, not a missing feature.
  const go = sequence.go;
  function onKeyDown(event: React.KeyboardEvent) {
    if (pinned) return;
    const to: string | undefined = {
      ArrowLeft: previous,
      ArrowRight: next,
      Home: '',
      End: endOfLine(),
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    go(to);
  }

  return (
    <div className="island chessboard-island">
      <div
        className={`chessboard-island__board cg-wrap cg-theme--${game.board.theme} cg-pieces--${game.board.pieces}`}
        ref={boardRef}
        tabIndex={pinned ? undefined : 0}
        role={pinned ? undefined : 'group'}
        aria-label={
          pinned
            ? `Chess diagram: ${moveLabel(node)}`
            : 'Chess board — arrow keys step through the game'
        }
        onKeyDown={onKeyDown}
      />
      {!pinned && (
        <div className="chessboard-island__controls">
          <div className="chessboard-island__buttons" role="group" aria-label="Move navigation">
            <button
              type="button"
              aria-label="First move"
              onClick={() => sequence.go('')}
              disabled={path === ''}
            >
              ⏮
            </button>
            <button
              type="button"
              aria-label="Previous move"
              onClick={() => sequence.go(previous ?? '')}
              disabled={previous === undefined}
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Next move"
              onClick={() => next && sequence.go(next)}
              disabled={next === undefined}
            >
              ▶
            </button>
          </div>
          <span className="chessboard-island__status" data-testid="chess-move">
            {moveLabel(node)}
          </span>
        </div>
      )}
      {pinned && <p className="chess-diagram__caption">{moveLabel(node)}</p>}
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
