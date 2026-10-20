import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  attrFlag,
  attrText,
  usePersistentState,
  type IslandComponentProps,
} from '@smart-ebooks/engine';
import {
  hasEvaluations,
  lineThrough,
  pgnToTree,
  readChessPosition,
  type SavedChessPosition,
} from './tree';
import { DEFAULT_BOARD_OPTIONS, type BoardOptions } from './boardOptions';
import { GameProvider, SequenceProvider } from './gameContext';
import ChessBoardInGame from './ChessBoardInGame';
import './chess.css';

/**
 * A game the author lays out themselves (SPEC001 §4.1, SPEC008 G4.1), read the
 * way the dedicated chess readers are read (SPEC008 G9.2).
 *
 * **The board is chrome, not content.** It sits in a region of its own above a
 * pane holding the author's prose, and that pane is the only thing that
 * scrolls. Which is why it cannot overlap the text, cannot be scrolled away
 * from, and needs no `position: sticky` — it was never in the prose flow.
 *
 * That reverses G4.1's arrangement, where the author placed a live board
 * among their paragraphs and it left the viewport as soon as the annotation
 * ran past a screen (C18). Every attempt to rescue that shape failed on the
 * same fact: a board in the flow of the prose it drives is a board the reader
 * scrolls away from. Chessable and ForwardChess both put it outside.
 *
 * The author still places *diagrams* — `::chess-board{at=…}`, `::chess-diagram`
 * — exactly as a printed book does, and the score wherever it belongs. What
 * they no longer have to place is the live board.
 */
export default function ChessGameIsland({
  id,
  attributes,
  packagedAssets,
  data,
  children,
}: IslandComponentProps) {
  const parsed = (data as { pgn?: string; board?: BoardOptions }) ?? {};
  const body = parsed.pgn ?? '';
  const board = parsed.board ?? DEFAULT_BOARD_OPTIONS;
  const shapes = attrFlag(attributes.shapes, true);

  // Same rule as a standalone board: only a *packaged* file is read, never a
  // URL an imported book chose.
  const assetUrl = packagedAssets.includes('pgn') ? attrText(attributes.pgn) : '';
  const [fromFile, setFromFile] = useState<{ url: string; pgn: string } | null>(null);

  useEffect(() => {
    if (!assetUrl) return;
    let cancelled = false;
    fetch(assetUrl)
      .then((response) => response.text())
      .then((pgn) => !cancelled && setFromFile({ url: assetUrl, pgn }))
      .catch(() => !cancelled && setFromFile({ url: assetUrl, pgn: '' }));
    return () => {
      cancelled = true;
    };
  }, [assetUrl]);

  const source = assetUrl ? (fromFile?.url === assetUrl ? fromFile.pgn : '') : body;
  const tree = useMemo(() => pgnToTree(source), [source]);

  // The same key a standalone board uses, and the same migration: a reader who
  // had this game as a `chess-board` keeps their place when the author rewrites
  // the chapter as a `chess-game`.
  const [stored, setStored] = usePersistentState<SavedChessPosition>(`chessply:${id}`, '');
  const { path: current, line } = readChessPosition(tree, stored);

  // The line the reader is on, not the main line: stepping forward inside a
  // sideline must stay inside it (SPEC001 P2.10b — `positions` is the active
  // line, recomputed as the reader branches).
  const positions = useMemo(() => lineThrough(tree, line ?? current), [tree, current, line]);
  const selectLine = useCallback(
    (path: string, line: string) => setStored({ path, line }),
    [setStored],
  );
  const go = (path: string) =>
    setStored(line && (path === '' || positions.includes(path)) ? { path, line } : path);
  const evalBar = attrFlag(attributes.evalBar) && hasEvaluations(tree);
  const game = useMemo(
    () => ({ tree, board, shapes, evalBar, line, selectLine }),
    [tree, board, shapes, evalBar, line, selectLine],
  );

  if (assetUrl && fromFile?.url !== assetUrl) {
    return <div className="island island--loading" aria-busy="true" />;
  }

  return (
    <GameProvider value={game}>
      <SequenceProvider positions={positions} current={current} onGo={go}>
        {/*
         * `ui-scroll-pane` on both, and only the inner one is literally a
         * scrollport. The class is the engine's marker for *this clips on
         * screen*, which the print stylesheet releases (SPEC008 G9.1/C19) — and
         * a height budget that bounds a scrolling child clips exactly as surely
         * as the child does. Leaving the outer cap unmarked would print the game
         * as a viewport-tall box with its prose spilling over whatever follows.
         */}
        <div className="chess-game ui-scroll-pane" data-testid="chess-game">
          <div className={`chess-game__board${tree.players ? ' chess-game__board--players' : ''}`}>
            <ChessBoardInGame players={tree.players} />
          </div>
          <div className="chess-game__prose ui-scroll-pane" data-testid="chess-game-prose">
            {children as ReactNode}
          </div>
        </div>
      </SequenceProvider>
    </GameProvider>
  );
}
