import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  attrFlag,
  attrText,
  usePersistentState,
  type IslandComponentProps,
} from '@smart-ebooks/engine';
import { mainline, mainlinePath, nodeAt, pgnToTree } from './tree';
import { DEFAULT_BOARD_OPTIONS, type BoardOptions } from './boardOptions';
import { GameProvider, SequenceProvider } from './gameContext';
import './chess.css';

/**
 * A game the author lays out themselves (SPEC001 §4.1, SPEC008 G4.1).
 *
 * `:::chess-game` renders **only its children**: prose, and `::chess-board` /
 * `::chess-moves` wherever the author puts them, with `:move` marks inside the
 * sentences. That is how printed chess books are written — a paragraph, a
 * diagram at the critical moment, more paragraphs — and it is the thing a board
 * pinned above a block of commentary cannot do.
 *
 * The container owns the game and the position and publishes both; it draws
 * nothing itself.
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
  const [fromFile, setFromFile] = useState<string | null>(null);

  useEffect(() => {
    if (!assetUrl) return;
    let cancelled = false;
    fetch(assetUrl)
      .then((response) => response.text())
      .then((text) => !cancelled && setFromFile(text))
      .catch(() => !cancelled && setFromFile(''));
    return () => {
      cancelled = true;
    };
  }, [assetUrl]);

  const source = assetUrl ? (fromFile ?? '') : body;
  const tree = useMemo(() => pgnToTree(source), [source]);

  // The same key a standalone board uses, and the same migration: a reader who
  // had this game as a `chess-board` keeps their place when the author rewrites
  // the chapter as a `chess-game`.
  const [stored, setStored] = usePersistentState<string | number>(`chessply:${id}`, '');
  const requested = typeof stored === 'number' ? mainlinePath(tree, stored) : stored;
  const current = requested && nodeAt(tree, requested) ? requested : '';

  // The line the reader is on, not the main line: stepping forward inside a
  // sideline must stay inside it (SPEC001 P2.10b — `positions` is the active
  // line, recomputed as the reader branches).
  const positions = useMemo(() => lineThrough(tree, current), [tree, current]);
  const game = useMemo(() => ({ tree, board, shapes }), [tree, board, shapes]);

  return (
    <GameProvider value={game}>
      <SequenceProvider positions={positions} current={current} onGo={setStored}>
        <div className="chess-game">{children as ReactNode}</div>
      </SequenceProvider>
    </GameProvider>
  );
}

/**
 * The ordered line the reader is on: from the start, through `current`, and on
 * to the end of whatever branch it sits in.
 */
function lineThrough(tree: ReturnType<typeof pgnToTree>, current: string): string[] {
  if (!current) return mainline(tree).map((node) => node.path);

  // A path is its own ancestry: `0.1.0` passed through `0` and `0.1`.
  const steps = current.split('.');
  const line = steps.map((_, index) => steps.slice(0, index + 1).join('.'));

  let node = nodeAt(tree, current);
  while (node?.children[0]) {
    node = node.children[0];
    line.push(node.path);
  }
  return line;
}
