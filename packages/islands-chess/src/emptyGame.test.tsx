// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import ChessBoardInGame from './ChessBoardInGame';
import ChessMovesIsland from './ChessMovesIsland';
import { GameProvider, SequenceProvider } from './gameContext';
import { pgnToTree } from './tree';
import { DEFAULT_BOARD_OPTIONS } from './boardOptions';

/**
 * The three ways a child island can find itself with nothing to draw used to
 * share one message, and it named the wrong one: a `chess-game` whose PGN was
 * missing or unparseable told the author their board was in the wrong place,
 * which sent them to the wrong line of the chapter.
 */
function game(pgn: string) {
  return { tree: pgnToTree(pgn), board: DEFAULT_BOARD_OPTIONS, shapes: true };
}

function inGame(pgn: string, child: ReactNode) {
  return (
    <GameProvider value={game(pgn)}>
      <SequenceProvider positions={[]} current="" onGo={() => {}}>
        {child}
      </SequenceProvider>
    </GameProvider>
  );
}

const board = <ChessBoardInGame id="b" attributes={{}} packagedAssets={[]} />;
const moves = <ChessMovesIsland id="m" attributes={{}} packagedAssets={[]} />;

let host: HTMLDivElement;
let root: Root;

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
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

describe('a child island with nothing to draw', () => {
  it('tells a board outside a game where it belongs', () => {
    mount(board);
    expect(host.textContent).toContain('has to be inside a chess-game');
  });

  it('tells a move list outside a game where it belongs', () => {
    mount(moves);
    expect(host.textContent).toContain('has to be inside a chess-game');
  });

  it('names the missing PGN rather than blaming the board\u2019s placement', () => {
    mount(inGame('', board));

    expect(host.textContent).toContain('no moves to show');
    // The old message, and the reason this test exists.
    expect(host.textContent).not.toContain('inside a chess-game');
  });

  it('says the same to a move list, because it is the same mistake', () => {
    mount(inGame('not a game', moves));

    expect(host.textContent).toContain('no moves to show');
    expect(host.textContent).not.toContain('inside a chess-game');
  });

  it('draws normally once the game has moves', () => {
    mount(inGame('1. e4 e5', board));

    expect(host.textContent).not.toContain('no moves to show');
    expect(host.querySelector('.chessboard-island')).not.toBeNull();
  });
});
