import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Chessground } from 'chessground';
import { attrText, type IslandComponentProps } from '@smart-ebooks/engine';
import {
  DEFAULT_BOARD_OPTIONS,
  orientationFor,
  resolveBoardOptions,
  type BoardOptions,
} from './boardOptions';
import { findByFen } from './score';
import { useGame, useSequence } from './gameContext';
import { parseShapes } from './shapes';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './chess.css';
import './themes.css';

/**
 * A position and nothing else — the commonest element in printed chess writing
 * (SPEC008 G1.2).
 *
 * No controls, no persisted state, no engine. Before this existed a diagram had
 * to be authored as a `chess-puzzle` with an empty solution, which rendered a
 * "Reveal solution" button and a "Solved" checkbox the author never wanted.
 *
 * `shapes` takes the same token syntax as PGN's `[%cal …]` / `[%csl …]` tags,
 * so an author only ever learns one spelling for an arrow.
 *
 * **Inside a `:::chess-game` it is also an input** (SPEC008 G9.3). Tapping it
 * sends its position to the game's live board, which is how a reader gets from
 * a moment printed in the prose to the board they can move pieces on. The
 * position is matched against the game rather than declared, so an author adds
 * nothing: a diagram of a position this game reaches becomes a control, and one
 * of a position it does not stays a figure.
 */
export default function ChessDiagramIsland({ attributes, data }: IslandComponentProps) {
  const {
    fen,
    caption = '',
    board = DEFAULT_BOARD_OPTIONS,
    boardAttrs = {},
  } = (data as {
    fen?: string;
    caption?: string;
    board?: BoardOptions;
    boardAttrs?: Record<string, string>;
  }) ?? {};

  const game = useGame();
  /*
   * **Inside a game, the container is the middle layer** (SPEC008 G9.4). A
   * diagram resolves its look over the *book's* defaults, which is right when
   * it stands alone and wrong the moment it sits in a `:::chess-game` that
   * chose a piece set: the boards took the container's, the diagram took the
   * book's, and one game rendered the same position in two costumes — visible
   * since G9.3 made tapping a diagram put its position on that very board.
   *
   * The diagram still wins where it speaks for itself, so `boardAttrs` is
   * layered on top. It is re-validated here rather than trusted: it is raw
   * authored text, and an imported book can put anything in it.
   */
  const { theme, pieces, orientation } = game ? resolveBoardOptions(boardAttrs, game.board) : board;

  // Kept as the raw string: parsing yields a fresh array every render, which as
  // an effect dependency would rebuild the board continuously.
  const shapes = attrText(attributes.shapes);
  const side = orientationFor(orientation, fen);
  const boardRef = useRef<HTMLDivElement>(null);

  const sequence = useSequence();
  const path = game && fen ? findByFen(game.tree, fen) : undefined;
  // `''` is the starting position and a perfectly good target, so this cannot
  // be a truthiness test.
  const opens = sequence !== undefined && path !== undefined;
  const current = opens && sequence.current === path;

  useEffect(() => {
    if (!boardRef.current || !fen) return;
    const api = Chessground(boardRef.current, {
      viewOnly: true,
      coordinates: true,
      fen,
      orientation: side,
      drawable: { enabled: false, visible: true },
    });
    const drawn = parseShapes(shapes);
    if (drawn.length > 0) api.setShapes(drawn);
    return () => api.destroy();
  }, [fen, side, shapes]);

  if (!fen) {
    return (
      <div className="island island--unknown" role="note">
        Diagram is missing a <code>fen</code>.
      </div>
    );
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!opens || (event.key !== 'Enter' && event.key !== ' ')) return;
    // Space scrolls the page by default, which is the opposite of what a reader
    // pressing it on a focused control expects.
    event.preventDefault();
    sequence.go(path);
  }

  return (
    <figure className={`island chess-diagram${opens ? ' chess-diagram--opens' : ''}`}>
      <div
        className={`chessboard-island__board cg-wrap cg-theme--${theme} cg-pieces--${pieces}`}
        ref={boardRef}
        role={opens ? 'button' : undefined}
        tabIndex={opens ? 0 : undefined}
        aria-current={current ? 'true' : undefined}
        aria-label={
          opens
            ? `${caption || 'Chess diagram'} — show this position on the board`
            : caption || 'Chess diagram'
        }
        onClick={opens ? () => sequence.go(path) : undefined}
        onKeyDown={opens ? onKeyDown : undefined}
      />
      {caption && <figcaption className="chess-diagram__caption">{caption}</figcaption>}
    </figure>
  );
}
