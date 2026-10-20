// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ChessGameIsland from './ChessGameIsland';
import ChessMoveIsland from './ChessMoveIsland';
import ChessBoardInGame from './ChessBoardInGame';
import ChessMovesIsland from './ChessMovesIsland';
import ChessBoardIsland from './ChessBoardIsland';

let saved: unknown;
vi.mock('@smart-ebooks/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@smart-ebooks/engine')>();
  return {
    ...actual,
    usePersistentState: (_key: string, initial: unknown) => {
      const [value, setValue] = useState(saved ?? initial);
      return [
        value,
        (next: unknown) => {
          saved = next;
          setValue(next);
        },
        true,
      ];
    },
  };
});

const PGN =
  '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 (4... Nd7) ' + '(4... Nf6 5. Nxf6+ gxf6 (5... exf6))';
const BRONSTEIN = '4... Nf6 5. Nxf6+ gxf6';
const TARTAKOWER = '4... Nf6 5. Nxf6+ exf6';

let host: HTMLDivElement;
let root: Root;

function mount(pgn = PGN, packaged = false) {
  act(() => {
    root.render(
      <ChessGameIsland
        id="routes"
        attributes={packaged ? { pgn: 'blob:game' } : {}}
        packagedAssets={packaged ? ['pgn'] : []}
        data={{ pgn }}
      >
        <ChessMoveIsland id="b" attributes={{ line: BRONSTEIN }} packagedAssets={[]}>
          4... Nf6
        </ChessMoveIsland>
        <ChessMoveIsland id="t" attributes={{ line: TARTAKOWER }} packagedAssets={[]}>
          4... Nf6
        </ChessMoveIsland>
        <ChessMoveIsland id="other" attributes={{}} packagedAssets={[]}>
          4... Nd7
        </ChessMoveIsland>
        <ChessBoardInGame at="4... Nf6" line={TARTAKOWER} />
        <ChessBoardInGame at="4... Nf6" line="4... Nf6 6. Nxf6+" />
        <ChessMovesIsland id="score" attributes={{}} packagedAssets={[]} />
      </ChessGameIsland>,
    );
  });
}

function board() {
  const element = host.querySelector('.chess-game__board');
  if (!element) throw new Error('live board not mounted');
  return element;
}

function click(name: string) {
  const button = board().querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  if (!button) throw new Error(`missing ${name} button`);
  act(() => button.click());
}

function key(value: string) {
  const element = board().querySelector('[role="group"][tabindex]');
  if (!element) throw new Error('live board not mounted');
  act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })));
}

function choose(index: number) {
  const button = host.querySelectorAll<HTMLButtonElement>('.chess-game__prose .chess-move')[index];
  if (!button) throw new Error(`missing move link ${index}`);
  act(() => button.click());
}

const status = () => board().querySelector('[data-testid="chess-move"]')?.textContent;

beforeEach(() => {
  saved = undefined;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('a chosen line through a shared opening', () => {
  it('shows the common starting move, then follows the selected continuation', () => {
    mount();
    choose(1);
    expect(status()).toBe('4... Nf6');
    click('Next move');
    expect(status()).toBe('5. Nxf6+');
    click('Next move');
    expect(status()).toBe('5... exf6');
    click('Previous move');
    click('Next move');
    expect(status()).toBe('5... exf6');
    choose(0);
    click('Next move');
    click('Next move');
    expect(status()).toBe('5... gxf6');
  });

  it('keeps the selected route through keyboard navigation, Home and End', () => {
    mount();
    choose(1);
    key('ArrowLeft');
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowRight');
    expect(status()).toBe('5... exf6');
    key('Home');
    expect(status()).toBe('Start');
    key('End');
    expect(status()).toBe('5... exf6');
  });

  it('restores both the current position and selected route after remounting', () => {
    mount();
    choose(1);
    act(() => root.unmount());
    root = createRoot(host);
    mount();
    expect(status()).toBe('4... Nf6');
    click('Next move');
    click('Next move');
    expect(status()).toBe('5... exf6');
  });

  it('keeps a route save usable if the author rewrites the game as a standalone board', () => {
    mount();
    choose(1);
    act(() => {
      root.render(
        <ChessBoardIsland id="routes" attributes={{}} packagedAssets={[]} data={{ pgn: PGN }} />,
      );
    });
    const next = host.querySelector<HTMLButtonElement>('button[aria-label="Next move"]');
    if (!next) throw new Error('standalone navigation not mounted');
    act(() => next.click());
    act(() => next.click());
    expect(host.querySelector('[data-testid="chess-move"]')?.textContent).toBe('5... exf6');
  });

  it('a pinned diagram selects the same route and an invalid pin does not become live', () => {
    mount();
    const diagram = host.querySelector<HTMLElement>('.chess-game__prose [role="button"]');
    expect(diagram).not.toBeNull();
    act(() => diagram?.click());
    click('Next move');
    click('Next move');
    expect(status()).toBe('5... exf6');
    expect(host.querySelectorAll('.chess-game__prose .chessboard-island__controls')).toHaveLength(
      0,
    );
    expect(host.textContent).toContain('does not select one move');
  });

  it('clears the preferred route when the reader deliberately chooses another variation', () => {
    mount();
    choose(1);
    choose(2);
    expect(status()).toBe('4... Nd7');
    key('End');
    expect(status()).toBe('4... Nd7');
  });

  it.each(['Enter', ' '])('activates the pinned route with %j', (value) => {
    mount();
    choose(0);
    const diagram = host.querySelector<HTMLElement>('.chess-game__prose [role="button"]');
    if (!diagram) throw new Error('pinned board not mounted');
    act(() => diagram.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })));
    key('End');
    expect(status()).toBe('5... exf6');
  });

  it('continues normally after the supplied route endpoint', () => {
    mount(PGN.replace('5... exf6)', '5... exf6 6. Nf3)'));
    choose(1);
    click('Next move');
    click('Next move');
    expect(status()).toBe('5... exf6');
    click('Next move');
    expect(status()).toBe('6. Nf3');
    key('Home');
    key('End');
    expect(status()).toBe('6. Nf3');
  });

  it('replaces the route even while both links name the very same position', () => {
    mount();
    choose(0);
    expect(status()).toBe('4... Nf6');
    choose(1);
    expect(status()).toBe('4... Nf6');
    const links = host.querySelectorAll('.chess-game__prose .chess-move');
    expect(links[0].hasAttribute('aria-current')).toBe(false);
    expect(links[1].getAttribute('aria-current')).toBe('true');
    key('End');
    expect(status()).toBe('5... exf6');
  });

  it('supports a game loaded from a packaged PGN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => PGN }));
    await act(async () => mount('', true));
    choose(1);
    click('Next move');
    click('Next move');
    expect(status()).toBe('5... exf6');
  });
});
