import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { useMessages } from '@smart-ebooks/engine';
import { orientationFor, type ResolvedOrientation } from './boardOptions';
import { moveLabel, resolveMoveReference } from './score';
import { allNodes, nodeAt, parentPath, type GameTree } from './tree';
import { useGame, useSequence } from './gameContext';
import EvalBar from './EvalBar';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './chess.css';
import './themes.css';

export interface GameBoardProps {
  /** Pin to one position, by the same move label `:move[…]` takes. */
  at?: string;
  line?: string;
}

interface LiveBoardProps extends GameBoardProps {
  players?: GameTree['players'];
}

/**
 * A board **inside** a `:::chess-game` (SPEC001 §4.1, SPEC008 G4.1).
 *
 * It owns no game and no position: both come from the container, so several
 * boards in one chapter stay in step and a `:move` in the prose drives them
 * all. Zero, one or a dozen are fine.
 *
 * `at` pins a board to a fixed position and takes its controls away — that is
 * the printed diagram, which stays put while the interactive board follows the
 * reader. Since G9.3 it is also a **tap target**: it shows a moment, and
 * touching that moment sends it to the live board.
 *
 * **Plain props rather than `IslandComponentProps`** (SPEC008 G9.2): the
 * container renders one of these itself, as the fixed board above its prose,
 * and it has no directive to read attributes from. The dispatcher adapts.
 */
export default function ChessBoardInGame({ at = '', line, players }: LiveBoardProps) {
  const game = useGame();
  const sequence = useSequence();

  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  const tree = game?.tree;
  // SPEC001 §4.1 sketched `at="4"`. A bare number is ambiguous — ply four or
  // move four? — and cannot name a position in a sideline at all, so `at` takes
  // the same move label `:move[…]` takes: `at="4. Qxf7#"`. One way to name a
  // position in this pack, not two.
  const reference = useMemo(
    () =>
      tree && (at || line !== undefined)
        ? resolveMoveReference(allNodes(tree), at, line)
        : undefined,
    [tree, at, line],
  );
  const invalidLine = line !== undefined && reference?.status !== 'resolved';
  const pinned = reference?.status === 'resolved' ? reference.path : '';
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
    if (!boardRef.current || !tree?.fen || invalidLine) return;
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
  }, [tree, side, invalidLine]);

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

  if (invalidLine) {
    return (
      <div className="island island--unknown" role="note">
        This <code>line</code> does not select one move in the game. Check its moves and{' '}
        <code>at</code> label.
      </div>
    );
  }

  const previous = node ? parentPath(node.path) : undefined;
  const next = sequence.positions[sequence.index + 1];
  const endOfLine = () => sequence.positions[sequence.positions.length - 1] ?? '';
  const selectPin = () => {
    if (reference?.status === 'resolved' && reference.line !== undefined) {
      game.selectLine(pinned, reference.line);
    } else {
      sequence.go(pinned);
    }
  };
  const names = pinned ? undefined : players;
  const top = side === 'white' ? 'black' : 'white';

  // The same keys a standalone board answers to. Losing them in the newer
  // authoring form would be an accessibility regression, not a missing feature.
  const go = sequence.go;
  function onKeyDown(event: React.KeyboardEvent) {
    if (pinned) {
      // A pinned board is a diagram, and G9.3 makes a diagram an *input*: the
      // keys that step a live board mean nothing here, but Enter and Space send
      // this position to the one the reader is using.
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectPin();
      return;
    }
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
    <div className={`island chessboard-island${names ? ' chessboard-island--players' : ''}`}>
      <PlayerLabel side={top} name={names?.[top]} position="top" />
      <div className="chessboard-island__stage">
        {/* Only the live board: a pinned diagram is a figure, not a readout. */}
        {game.evalBar && !pinned && <EvalBar evaluation={node?.evaluation} orientation={side} />}
        <div
          className={`chessboard-island__board cg-wrap cg-theme--${game.board.theme} cg-pieces--${game.board.pieces}`}
          ref={boardRef}
          /*
           * **C15 said a diagram is not a control, and G9.3 reverses that.** The
           * argument was sound while a diagram only ever displayed: giving a
           * picture focus buys a keyboard user a stop on the way to nothing. It
           * stops being sound the moment tapping it *does* something — it is now
           * how a reader gets from a moment printed in the prose to the board they
           * can move pieces on, and a control reachable only by mouse is the
           * regression C15 was written to prevent.
           */
          tabIndex={0}
          role={pinned ? 'button' : 'group'}
          aria-current={
            pinned &&
            sequence.current === pinned &&
            (line === undefined ||
              (reference?.status === 'resolved' && game.line === reference.line))
              ? 'true'
              : undefined
          }
          aria-label={
            pinned
              ? `Chess diagram: ${moveLabel(node)} — show this position on the board`
              : 'Chess board — arrow keys step through the game'
          }
          onClick={pinned ? selectPin : undefined}
          onKeyDown={onKeyDown}
        />
      </div>
      <PlayerLabel side={side} name={names?.[side]} position="bottom" />
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
    </div>
  );
}

function PlayerLabel({
  side,
  name,
  position,
}: {
  side: ResolvedOrientation;
  name?: string;
  position: 'top' | 'bottom';
}) {
  const words = useMessages();
  const rowRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const label = side === 'white' ? words.chessWhite : words.chessBlack;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !name) return;
    const measure = () => {
      const text = nameRef.current;
      if (!text) return;
      // Measure the space without the disclosure icon so adding it cannot keep
      // an otherwise fitting name permanently expandable.
      const available = row.getBoundingClientRect().right - text.getBoundingClientRect().left;
      setTruncated(text.scrollWidth > Math.round(available));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [name, label]);

  if (!name) return null;
  const content = (
    <>
      <span className="chess-player__side">{label}: </span>
      <span className="chess-player__name" ref={nameRef}>
        {name}
      </span>
    </>
  );
  return (
    <div className={`chess-player chess-player--${position}`} ref={rowRef}>
      {truncated ? (
        <details key={name}>
          <summary className="chess-player__label">{content}</summary>
          <div className="chess-player__full" tabIndex={0}>
            {name}
          </div>
        </details>
      ) : (
        <div className="chess-player__label">{content}</div>
      )}
    </div>
  );
}
