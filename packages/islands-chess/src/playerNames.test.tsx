// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MessagesProvider } from '@smart-ebooks/engine';
import ChessGameIsland from './ChessGameIsland';
import ChessBoardInGame from './ChessBoardInGame';
import ChessMoveIsland from './ChessMoveIsland';
import { DEFAULT_BOARD_OPTIONS, type Orientation } from './boardOptions';

const storage = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb-keyval', async (importOriginal) => ({
  ...(await importOriginal<typeof import('idb-keyval')>()),
  get: async (key: string) => storage.get(key),
  set: async (key: string, value: unknown) => {
    storage.set(key, value);
  },
  del: async (key: string) => {
    storage.delete(key);
  },
  entries: async () => [...storage.entries()],
}));

const MOVES = '1. e4 c6 (1... e5 2. Nf3) 2. d4 d5';
const NAMED = `[White "Greet, Andrew"]\n[Black "Arkell, Keith"]\n\n${MOVES}`;
let host: HTMLDivElement;
let root: Root;

async function render({
  pgn = NAMED,
  orientation = 'black',
  language = 'en',
  asset,
}: {
  pgn?: string;
  orientation?: Orientation;
  language?: 'en' | 'fr';
  asset?: string;
} = {}) {
  await act(async () => {
    root.render(
      <MessagesProvider language={language}>
        <ChessGameIsland
          id="players"
          attributes={asset ? { pgn: asset } : {}}
          packagedAssets={asset ? ['pgn'] : []}
          data={{ pgn, board: { ...DEFAULT_BOARD_OPTIONS, orientation } }}
        >
          <ChessBoardInGame at="1. e4" />
          <ChessBoardInGame />
          <ChessMoveIsland id="sideline" attributes={{}} packagedAssets={[]}>
            2. Nf3
          </ChessMoveIsland>
        </ChessGameIsland>
      </MessagesProvider>,
    );
  });
}

const labels = () =>
  [...host.querySelectorAll('.chess-game__board .chess-player__label')].map(
    (element) => element.textContent,
  );

beforeEach(() => {
  storage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('player names on the live game board', () => {
  it('does not offer disclosure controls when both names fit', async () => {
    await render();
    expect(host.querySelectorAll('.chess-player summary')).toHaveLength(0);
    expect(host.querySelectorAll('.chess-player__full')).toHaveLength(0);
  });

  it('places White above and Black below when viewing from Black', async () => {
    await render();
    expect(labels()).toEqual(['White: Greet, Andrew', 'Black: Arkell, Keith']);
    expect(host.querySelector('.chess-game__prose .chess-player')).toBeNull();
    const board = host.querySelector('.chess-game__board .chessboard-island__stage');
    const top = host.querySelector('.chess-player--top');
    const bottom = host.querySelector('.chess-player--bottom');
    expect(
      top && board && top.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      bottom && board && board.compareDocumentPosition(bottom) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('follows the effective orientation, including auto, without flipping at every move', async () => {
    await render({ orientation: 'auto' });
    expect(labels()).toEqual(['Black: Arkell, Keith', 'White: Greet, Andrew']);
    const next = host.querySelector<HTMLButtonElement>(
      '.chess-game__board [aria-label="Next move"]',
    );
    await act(async () => next?.click());
    expect(labels()).toEqual(['Black: Arkell, Keith', 'White: Greet, Andrew']);
    await render({ orientation: 'black' });
    expect(labels()).toEqual(['White: Greet, Andrew', 'Black: Arkell, Keith']);
    await render({ orientation: 'white' });
    expect(labels()).toEqual(['Black: Arkell, Keith', 'White: Greet, Andrew']);
  });

  it('resolves auto against a Black-to-move starting position', async () => {
    await render({
      orientation: 'auto',
      pgn:
        '[White "Greet, Andrew"]\n[Black "Arkell, Keith"]\n' +
        '[FEN "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]\n\n3... a6 4. Ba4',
    });
    expect(labels()).toEqual(['White: Greet, Andrew', 'Black: Arkell, Keith']);
  });

  it('keeps the names while entering a sideline and changes only the localized side labels', async () => {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('.chess-move')?.click());
    expect(host.querySelector('.chess-game__board [data-testid="chess-move"]')?.textContent).toBe(
      '2. Nf3',
    );
    expect(labels()).toEqual(['White: Greet, Andrew', 'Black: Arkell, Keith']);
    await render({ language: 'fr' });
    expect(labels()).toEqual(['Blancs: Greet, Andrew', 'Noirs: Arkell, Keith']);
  });

  it.each(['', '?', '   ', ' ? '])('omits both unavailable name rows for %j', async (name) => {
    await render({ pgn: `[White "${name}"]\n[Black "${name}"]\n\n${MOVES}` });
    expect(host.querySelector('.chess-player')).toBeNull();
    expect(host.querySelector('.chess-game__board--players')).toBeNull();
    expect(host.querySelector('.chessboard-island--players')).toBeNull();
  });

  it('shows only the available name, on the correct side', async () => {
    await render({ pgn: `[White "?"]\n[Black "Arkell, Keith"]\n\n${MOVES}` });
    expect(labels()).toEqual(['Black: Arkell, Keith']);
    expect(host.querySelector('.chess-player--top')).toBeNull();
    expect(host.querySelector('.chess-player--bottom')).not.toBeNull();
  });

  it('replaces the players and removes all rows for a subsequent headerless game', async () => {
    await render();
    await render({ pgn: `[White "Élodie"]\n[Black "José"]\n\n${MOVES}` });
    expect(labels()).toEqual(['White: Élodie', 'Black: José']);
    await render({ pgn: MOVES });
    expect(labels()).toEqual([]);
    expect(host.querySelector('.chess-game__board--players')).toBeNull();
  });

  it('renders HTML-like names as text and offers a native disclosure for the full name', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500);
    const name = 'Élodie <img src=x onerror=alert(1)> de la Tour';
    await render({ pgn: `[White "${name}"]\n[Black "?"]\n\n${MOVES}` });
    expect(labels()).toEqual([`White: ${name}`]);
    expect(host.querySelector('img')).toBeNull();
    const row = host.querySelector<HTMLDetailsElement>('.chess-player details');
    const summary = row?.querySelector('summary');
    expect(summary?.textContent).toBe(`White: ${name}`);
    act(() => summary?.click());
    expect(row?.open).toBe(true);
    expect(row?.querySelector('.chess-player__full')?.textContent).toBe(name);
  });

  it('removes the disclosure when a new player name fits', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500);
    await render();
    expect(host.querySelectorAll('.chess-player summary')).toHaveLength(2);
    width.mockReturnValue(0);
    await render({ pgn: `[White "Élodie"]\n[Black "?"]\n\n${MOVES}` });
    expect(labels()).toEqual(['White: Élodie']);
    expect(host.querySelector('.chess-player summary')).toBeNull();
    expect(host.querySelector('.chess-player__full')).toBeNull();
  });

  it('uses the same player metadata from a packaged PGN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => NAMED }));
    await render({ pgn: '', asset: 'blob:game' });
    expect(labels()).toEqual(['White: Greet, Andrew', 'Black: Arkell, Keith']);
  });

  it('does not keep the previous asset players while loading a different PGN', async () => {
    const pending = new Map<string, (response: { text: () => Promise<string> }) => void>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => new Promise((resolve) => pending.set(url, resolve))),
    );
    const finish = async (url: string, pgn: string) => {
      const resolve = pending.get(url);
      if (!resolve) throw new Error(`No pending request for ${url}`);
      await act(async () => resolve({ text: async () => pgn }));
    };
    await render({ pgn: '', asset: 'blob:first' });
    await finish('blob:first', NAMED);
    expect(labels()).toHaveLength(2);
    await render({ pgn: '', asset: 'blob:second' });
    expect(labels()).toEqual([]);
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).not.toContain('no moves to show');
    await finish('blob:second', `[White "Élodie"]\n[Black "José"]\n\n${MOVES}`);
    expect(labels()).toEqual(['White: Élodie', 'Black: José']);
    await render({ pgn: '', asset: 'blob:headerless' });
    expect(labels()).toEqual([]);
    await finish('blob:headerless', MOVES);
    expect(labels()).toEqual([]);
  });

  it('ignores a cancelled asset response after a newer game has loaded', async () => {
    let finishFirst: ((response: { text: () => Promise<string> }) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValueOnce({
          text: async () => `[White "Élodie"]\n[Black "José"]\n\n${MOVES}`,
        }),
    );
    await render({ pgn: '', asset: 'blob:first' });
    await render({ pgn: '', asset: 'blob:second' });
    expect(labels()).toEqual(['White: Élodie', 'Black: José']);
    const resolve = finishFirst;
    if (!resolve) throw new Error('First asset request not mounted');
    await act(async () => resolve({ text: async () => NAMED }));
    expect(labels()).toEqual(['White: Élodie', 'Black: José']);
  });
});
