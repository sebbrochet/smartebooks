// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { ReactNode } from 'react';
import ChessMoveIsland from './ChessMoveIsland';
import { GameProvider, SequenceProvider } from './gameContext';
import { pgnToTree } from './tree';
import { DEFAULT_BOARD_OPTIONS } from './boardOptions';

const game = { tree: pgnToTree('1. e4 e5 2. Bc4'), board: DEFAULT_BOARD_OPTIONS, shapes: true };

let host: HTMLDivElement;
let root: Root;
let went: string[];

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

/** The mark as an author writes it, inside a game. */
function inGame(label: string) {
  return (
    <GameProvider value={game}>
      <SequenceProvider positions={[]} current="" onGo={(path) => went.push(path)}>
        <ChessMoveIsland id="m" attributes={{}} packagedAssets={[]}>
          {label}
        </ChessMoveIsland>
      </SequenceProvider>
    </GameProvider>
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  went = [];
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a move named in a sentence', () => {
  it('is operable, and sets the position it names', () => {
    mount(inGame('2. Bc4'));

    const button = host.querySelector('button');
    expect(button?.textContent).toBe('2. Bc4');

    act(() => button?.click());
    expect(went).toEqual(['0.0.0']);
  });

  // The failure mode this guards against is a dead button mid-sentence: it
  // looks operable, does nothing, and the reader cannot tell why.
  it('is the plain words when the game does not contain that move', () => {
    mount(inGame('9. Rxh8'));

    expect(host.querySelector('button')).toBeNull();
    expect(host.textContent).toBe('9. Rxh8');
  });

  it('is the plain words outside a game, so a stray mark cannot break a page', () => {
    mount(
      <ChessMoveIsland id="m" attributes={{}} packagedAssets={[]}>
        2. Bc4
      </ChessMoveIsland>,
    );

    expect(host.querySelector('button')).toBeNull();
    expect(host.textContent).toBe('2. Bc4');
  });

  it('marks the move the reader is on', () => {
    mount(
      <GameProvider value={game}>
        <SequenceProvider positions={['0', '0.0', '0.0.0']} current="0.0.0" onGo={() => {}}>
          <ChessMoveIsland id="m" attributes={{}} packagedAssets={[]}>
            2. Bc4
          </ChessMoveIsland>
        </SequenceProvider>
      </GameProvider>,
    );

    expect(host.querySelector('button')?.getAttribute('aria-current')).toBe('true');
  });
});
