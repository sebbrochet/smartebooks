// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { usePersistentState } from './usePersistentState';
import { saveState } from './store';
import { BookProvider } from '../reader/BookContext';
import { createIslandRegistry } from '../islandRegistry';

// jsdom has no IndexedDB, so back idb-keyval with an in-memory map.
const { memStore } = vi.hoisted(() => ({ memStore: new Map<string, unknown>() }));

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

const registry = createIslandRegistry([]);

/** Two islands in one book, both reading the same key. */
function Pair() {
  const [a] = usePersistentState<number>('stamina:hero', 10);
  const [b] = usePersistentState<number>('stamina:hero', 10);
  return (
    <>
      <span data-testid="a">{a}</span>
      <span data-testid="b">{b}</span>
    </>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  memStore.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(
      <BookProvider slug="demo" trusted registry={registry}>
        <Pair />
      </BookProvider>,
    );
  });
}

const shown = () =>
  [...container.querySelectorAll('span')].map((node) => node.textContent).join(',');

describe('usePersistentState following the store', () => {
  it('starts from the stored value', async () => {
    memStore.set('smart-ebooks:demo:stamina:hero', 7);
    await render();
    expect(shown()).toBe('7,7');
  });

  // The gamebook case: a dice roll must reach the character sheet beside it,
  // not wait for a reload (SPEC001 L13).
  it('updates every reader of a key when one island writes it', async () => {
    await render();
    expect(shown()).toBe('10,10');

    await act(async () => {
      await saveState('demo', 'stamina:hero', 4);
    });

    expect(shown()).toBe('4,4');
  });

  it('ignores writes to a different key', async () => {
    await render();
    await act(async () => {
      await saveState('demo', 'gold:hero', 999);
    });
    expect(shown()).toBe('10,10');
  });

  it('ignores writes to the same key in another book', async () => {
    await render();
    await act(async () => {
      await saveState('other-book', 'stamina:hero', 1);
    });
    expect(shown()).toBe('10,10');
  });

  it('stops listening once unmounted', async () => {
    await render();
    await act(() => root.unmount());
    // A write after unmount must not attempt to set state on a dead tree; the
    // test fails on the React warning if the subscription leaked.
    await act(async () => {
      await saveState('demo', 'stamina:hero', 3);
    });
    expect(container.textContent).toBe('');
    // Re-created in afterEach's unmount path.
    root = createRoot(container);
  });
});
