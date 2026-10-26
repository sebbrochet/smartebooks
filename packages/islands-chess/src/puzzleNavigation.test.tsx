// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import { BookProvider, createIslandRegistry, MessagesProvider } from '@smart-ebooks/engine';
import { renderMarkdown } from '../../engine/src/markdown/render';
import ChessPuzzleIsland from './ChessPuzzleIsland';

const { board, memStore } = vi.hoisted(() => ({
  board: { config: undefined as Config | undefined },
  memStore: new Map<string, unknown>(),
}));

vi.mock('chessground', () => ({
  Chessground: (_element: unknown, config: Config) => {
    board.config = config;
    return { destroy() {} };
  },
}));

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

const registry = createIslandRegistry([
  {
    name: 'chess-puzzle',
    component: ChessPuzzleIsland,
    extract: (node) => ({
      fen: (node as { attributes: Record<string, string> }).attributes.fen,
      solution: 'The explanation.',
    }),
  },
]);
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const NEXT = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  memStore.clear();
  board.config = undefined;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function show(id: string, fen = START, solution = 'e4 e5 Nf3', slug = 'demo') {
  await act(async () => {
    root.render(
      <MessagesProvider language="en">
        <BookProvider slug={slug} trusted={false} registry={registry}>
          {renderMarkdown(
            `:::chess-puzzle{id="${id}" fen="${fen}" solution="${solution}" hint="A hint."}\n:::`,
            {
              registry,
              trusted: false,
            },
          )}
        </BookProvider>
      </MessagesProvider>,
    );
  });
}

async function move(from: Key, to: Key) {
  const after = board.config?.movable?.events?.after;
  expect(after).toBeTypeOf('function');
  await act(async () => after?.(from, to, { premove: false }));
}

async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find((node) => node.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

const status = () => host.querySelector('[role="status"]')?.textContent;

describe('puzzle identity during imported-book navigation', () => {
  it('reveals a self-assessment before offering outcomes and lets the reader retry', async () => {
    await show('reflection', NEXT, '');
    expect(status()).toBe('Your turn to think.');
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    expect(host.textContent).not.toContain('I found it');
    expect(host.querySelector('.chesspuzzle__solution')).toBeNull();

    await click('See answer');
    expect(host.querySelector('.chesspuzzle__solution')?.textContent).toBe('The explanation.');
    await click('I found it');
    expect(status()).toBe('Self-assessed: found it.');
    expect(memStore.get('smart-ebooks:demo:chesspuzzle:reflection')).toEqual({
      solved: true,
      assessment: 'found',
    });

    await show('other');
    await show('reflection', NEXT, '');
    expect(status()).toBe('Self-assessed: found it.');
    await click('Play again');
    expect(status()).toBe('Your turn to think.');
    expect(host.querySelector('.chesspuzzle__solution')).toBeNull();
  });

  it('remembers a self-assessment that needs practice without marking it solved', async () => {
    await show('reflection', NEXT, '');
    await click('See answer');
    await click('Needs practice');
    expect(status()).toBe('Needs practice.');
    expect(memStore.get('smart-ebooks:demo:chesspuzzle:reflection')).toEqual({
      solved: false,
      assessment: 'review',
    });
    expect(host.querySelector('.is-solved')).toBeNull();
    await show('other');
    await show('reflection', NEXT, '');
    expect(status()).toBe('Needs practice.');
    await click('Play again');
    expect(status()).toBe('Your turn to think.');
  });

  it('preserves an older self-marked completion', async () => {
    memStore.set('smart-ebooks:demo:chesspuzzle:reflection', { solved: true });
    await show('reflection', NEXT, '');
    expect(status()).toBe('Self-assessed: found it.');
    await click('Play again');
    expect(status()).toBe('Your turn to think.');
  });

  it('starts a different puzzle with its own position, feedback and hint visibility', async () => {
    await show('first');
    await click('Hint');
    await move('e2', 'e4');
    expect(status()).not.toBe('Your move.');
    expect(host.querySelector('.chesspuzzle__hint')).not.toBeNull();

    await show('second', NEXT, 'Ra8#');
    expect(status()).toBe('Your move.');
    expect(board.config?.fen).toBe(NEXT);
    expect(board.config?.viewOnly).toBe(false);
    expect(host.querySelector('.chesspuzzle__hint')).toBeNull();
    expect(host.querySelector('.chesspuzzle__restart')).toBeNull();
    await move('a1', 'a8');
    expect(status()).toBe('Solved');
  });

  it('keeps an unfinished attempt when the same puzzle re-renders', async () => {
    await show('first');
    await move('e2', 'e4');
    const feedback = status();
    const fen = board.config?.fen;
    await show('first');
    expect(status()).toBe(feedback);
    expect(board.config?.fen).toBe(fen);
    await move('g1', 'f3');
    expect(status()).toBe('Solved');
  });

  it('does not carry an attempt into another book using the same puzzle id', async () => {
    await show('shared');
    await move('e2', 'e4');
    await show('shared', NEXT, 'Ra8#', 'other');
    expect(status()).toBe('Your move.');
    expect(board.config?.fen).toBe(NEXT);
    await move('a1', 'a8');
    expect(status()).toBe('Solved');
    expect(memStore.get('smart-ebooks:other:chesspuzzle:shared')).toEqual({ solved: true });
    expect(memStore.has('smart-ebooks:demo:chesspuzzle:shared')).toBe(false);
  });

  it("restores saved completion without revealing another puzzle's explanation", async () => {
    await show('first', NEXT, 'Ra8#');
    await move('a1', 'a8');
    expect(status()).toBe('Solved');
    expect(host.querySelector('.chesspuzzle__solution')).not.toBeNull();

    await show('second');
    expect(status()).toBe('Your move.');
    expect(host.querySelector('.chesspuzzle__solution')).toBeNull();

    await show('first', NEXT, 'Ra8#');
    expect(status()).toBe('Solved');
    expect(board.config?.viewOnly).toBe(true);
    expect(host.querySelector('.chesspuzzle__solution')).toBeNull();
    await click('Play again');
    expect(status()).toBe('Your move.');
    await move('a1', 'a8');
    expect(status()).toBe('Solved');
  });
});
