// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import { DEFAULT_BOARD_OPTIONS } from './boardOptions';
import ChessPuzzleIsland from './ChessPuzzleIsland';

/**
 * A puzzle has to tell the board whose turn it is.
 *
 * Chessground does **not** read the side to move from the FEN it is given — its
 * `fen` config carries the piece placement and nothing else — and `turnColor`
 * defaults to `white` (`chessground/src/state.ts`). Every move then goes through
 * `isMovable`, which requires *both* `movable.color === piece.color` **and**
 * `turnColor === piece.color` (`chessground/src/board.ts`).
 *
 * So a puzzle with Black to move used to set `movable.color: 'black'` against a
 * `turnColor` still saying `white`, and the two disagreed: the board rendered,
 * reported itself `manipulable`, carried a correct `dests` map — and refused to
 * let the reader pick up a single piece. Nothing failed; the puzzle was simply
 * dead, which is the worst shape a defect can take in a book.
 *
 * Found by a Black repertoire, where most puzzles are Black to move. A book of
 * White-to-move mating puzzles would never have shown it.
 */

// `vi.mock` is hoisted above every import, so what its factory captures must be too.
const { configs, memStore } = vi.hoisted(() => ({
  configs: [] as Record<string, unknown>[],
  memStore: new Map<string, unknown>(),
}));

// jsdom has no IndexedDB, so back idb-keyval with an in-memory map.
vi.mock('idb-keyval', () => ({
  get: async (key: string) => memStore.get(key),
  set: async (key: string, value: unknown) => {
    memStore.set(key, value);
  },
  del: async (key: string) => {
    memStore.delete(key);
  },
  entries: async () => [...memStore.entries()],
  createStore: () => undefined,
}));

// The real Chessground still runs — this only records what it was handed, so an
// invalid config would throw here rather than pass a test about a config shape.
vi.mock('chessground', async (importOriginal) => {
  const actual = await importOriginal<typeof import('chessground')>();
  return {
    ...actual,
    Chessground: (el: HTMLElement, config: Record<string, unknown>) => {
      configs.push(config);
      return actual.Chessground(el, config as never);
    },
  };
});

/** Chapter 2 of the Caro-Kann book: Black to play the thematic break. */
const BLACK_TO_MOVE = 'rn1qkbnr/pp3ppp/2p1p3/3pPb2/3P4/5N2/PPP1BPPP/RNBQK2R b KQkq - 1 5';
/** Chapter 1: White to play mate in one. This one always worked. */
const WHITE_TO_MOVE = 'r1bqkb1r/pp1npppp/2p2n2/8/3PN3/8/PPP1QPPP/R1B1KBNR w KQkq - 3 6';

function puzzle(id: string, fen: string, solution: string) {
  return (
    <ChessPuzzleIsland
      id={id}
      attributes={{ solution }}
      packagedAssets={[]}
      data={{ fen, solution, board: DEFAULT_BOARD_OPTIONS }}
    />
  );
}

let host: HTMLDivElement;
let root: Root;

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

/** The config the island actually handed Chessground. */
function lastConfig() {
  return configs[configs.length - 1] as { turnColor?: string; movable?: { color?: string } };
}

beforeEach(() => {
  configs.length = 0;
  memStore.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a playable puzzle', () => {
  it('tells the board it is Black to move', () => {
    mount(puzzle('black-to-move', BLACK_TO_MOVE, 'c5'));
    expect(lastConfig().turnColor).toBe('black');
  });

  it('tells the board it is White to move', () => {
    mount(puzzle('white-to-move', WHITE_TO_MOVE, 'Nd6#'));
    expect(lastConfig().turnColor).toBe('white');
  });

  it('never lets turnColor and movable.color disagree', () => {
    for (const [id, fen, solution] of [
      ['a', BLACK_TO_MOVE, 'c5'],
      ['b', WHITE_TO_MOVE, 'Nd6#'],
    ] as const) {
      mount(puzzle(id, fen, solution));
      const config = lastConfig();
      // Either both are set to the same side, or the board is not playable at all.
      expect(config.turnColor).toBe(config.movable?.color);
    }
  });
});
