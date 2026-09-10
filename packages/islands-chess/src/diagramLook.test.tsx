// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import ChessDiagramIsland from './ChessDiagramIsland';
import ChessBoardInGame from './ChessBoardInGame';
import { GameProvider, SequenceProvider } from './gameContext';
import { pgnToTree } from './tree';
import { DEFAULT_BOARD_OPTIONS, type BoardOptions } from './boardOptions';

/**
 * Where a diagram gets its look from (SPEC008 G9.4).
 *
 * A diagram resolves `theme`/`pieces` over the *book's* defaults, which is the
 * right answer while it stands alone and the wrong one the moment it sits in a
 * `:::chess-game` that chose something else: the container's boards took the
 * container's look and the diagram took the book's, so one game drew the same
 * position two ways. G9.3 made that visible by turning a diagram into the way
 * on to the very board it disagreed with.
 *
 * The layering is book, then container, then the diagram's own attributes.
 */
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const BOOK: BoardOptions = { ...DEFAULT_BOARD_OPTIONS, theme: 'blue', pieces: 'cburnett' };
const CONTAINER: BoardOptions = { ...DEFAULT_BOARD_OPTIONS, theme: 'grey', pieces: 'unicode' };

function diagram(boardAttrs: Record<string, string> = {}) {
  return (
    <ChessDiagramIsland
      id="d"
      attributes={{}}
      packagedAssets={[]}
      data={{ fen: START, caption: '', board: BOOK, boardAttrs }}
    />
  );
}

function inGame(child: ReactNode, board: BoardOptions) {
  return (
    <GameProvider value={{ tree: pgnToTree('1. e4 e5'), board, shapes: true }}>
      <SequenceProvider positions={[]} current="" onGo={() => {}}>
        {child}
      </SequenceProvider>
    </GameProvider>
  );
}

let host: HTMLDivElement;
let root: Root;

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

/** The modifier classes the stylesheet keys the look off. */
function look(selector = '.chess-diagram .chessboard-island__board') {
  const el = host.querySelector(selector);
  return el ? Array.from(el.classList).filter((c) => c.startsWith('cg-')) : [];
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a diagram takes its look from the nearest thing that chose one', () => {
  it("uses the book's defaults when it stands alone", () => {
    mount(diagram());
    expect(look()).toContain('cg-theme--blue');
    expect(look()).toContain('cg-pieces--cburnett');
  });

  it('follows the container it is inside, not the book', () => {
    mount(inGame(diagram(), CONTAINER));
    expect(look()).toContain('cg-theme--grey');
    expect(look()).toContain('cg-pieces--unicode');
  });

  it('matches the board of the game it can put a position on', () => {
    mount(
      inGame(
        <>
          <ChessBoardInGame />
          {diagram()}
        </>,
        CONTAINER,
      ),
    );

    expect(look('.chess-diagram .chessboard-island__board')).toEqual(
      look('.island.chessboard-island > .chessboard-island__board'),
    );
  });

  it('still lets the diagram speak for itself', () => {
    mount(inGame(diagram({ theme: 'green' }), CONTAINER));
    // Its own attribute wins over the container...
    expect(look()).toContain('cg-theme--green');
    // ...and everything it did not name still comes from the container.
    expect(look()).toContain('cg-pieces--unicode');
  });

  it('ignores a value an imported book invented', () => {
    mount(inGame(diagram({ theme: 'chartreuse', pieces: 'javascript:alert(1)' }), CONTAINER));
    expect(look()).toContain('cg-theme--grey');
    expect(look()).toContain('cg-pieces--unicode');
  });
});
