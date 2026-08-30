import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import { attrText, type IslandComponentProps } from '@smart-ebooks/engine';
import { DEFAULT_BOARD_OPTIONS, orientationFor, type BoardOptions } from './boardOptions';
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
 */
export default function ChessDiagramIsland({ attributes, data }: IslandComponentProps) {
  const {
    fen,
    caption = '',
    board = DEFAULT_BOARD_OPTIONS,
  } = (data as { fen?: string; caption?: string; board?: BoardOptions }) ?? {};
  const { theme, pieces, orientation } = board;
  // Kept as the raw string: parsing yields a fresh array every render, which as
  // an effect dependency would rebuild the board continuously.
  const shapes = attrText(attributes.shapes);
  const side = orientationFor(orientation, fen);
  const boardRef = useRef<HTMLDivElement>(null);

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

  return (
    <figure className="island chess-diagram">
      <div
        className={`chessboard-island__board cg-wrap cg-theme--${theme} cg-pieces--${pieces}`}
        ref={boardRef}
        aria-label={caption || 'Chess diagram'}
      />
      {caption && <figcaption className="chess-diagram__caption">{caption}</figcaption>}
    </figure>
  );
}
