// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { QuizIsland } from './QuizIsland';
import { IslandHost } from '../markdown/IslandHost';
import { defaultIslands } from './defaults';
import { BookProvider } from '../reader/BookContext';
import { createIslandRegistry } from '../islandRegistry';
import type { QuizQuestion } from '../types';

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
/** The real registry, so the host can resolve `quiz` the way a book does. */
const hosted = createIslandRegistry(defaultIslands);

const questions: QuizQuestion[] = [
  {
    prompt: 'Which one is right?',
    multi: false,
    options: [
      { text: 'right', correct: true },
      { text: 'wrong-1', correct: false },
      { text: 'wrong-2', correct: false },
      { text: 'wrong-3', correct: false },
    ],
  },
];

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
  vi.restoreAllMocks();
});

async function render(shuffle: string) {
  await act(async () => {
    root.render(
      <BookProvider slug="demo" trusted registry={registry}>
        <QuizIsland id="q" attributes={{ shuffle }} packagedAssets={[]} data={questions} />
      </BookProvider>,
    );
  });
}

const optionTexts = () =>
  [...container.querySelectorAll('.quiz__option span')].map((node) => node.textContent);

/** The option a reader would click, found the way they find it: by reading it. */
function inputFor(text: string): HTMLInputElement {
  const label = [...container.querySelectorAll('.quiz__option')].find(
    (node) => node.querySelector('span')?.textContent === text,
  );
  return label?.querySelector('input') as HTMLInputElement;
}

describe('a quiz that has been shuffled', () => {
  it('shows the options somewhere other than where they were written', async () => {
    // Always swapping with the first slot: enough to prove the deck was cut,
    // without depending on which permutation a real shuffle produces.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await render('options');

    expect(optionTexts()).not.toEqual(['right', 'wrong-1', 'wrong-2', 'wrong-3']);
    expect([...optionTexts()].sort()).toEqual(['right', 'wrong-1', 'wrong-2', 'wrong-3']);
  });

  /**
   * The wiring this file exists for.
   *
   * Answers are recorded against the option the author wrote, and only the
   * *display* is permuted. Map a selection through the order by mistake — an
   * easy "simplification" — and the reader who picks the correct answer is
   * marked wrong, which no reader could diagnose and no author would see while
   * the quiz was unshuffled.
   */
  it('marks the answer the reader actually clicked, not the one in that position', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await render('options');

    await act(async () => {
      inputFor('right').click();
    });

    // The tick has to land on the option the reader pressed, wherever it sits.
    expect(inputFor('right').checked).toBe(true);

    await act(async () => {
      (container.querySelector('.quiz__submit') as HTMLButtonElement).click();
    });

    // The score is the assertion that discriminates: the styling of a correct
    // option is the same whether or not the reader chose it.
    expect(container.querySelector('.quiz__result')?.textContent).toContain('Score: 1 / 1');
    expect(container.querySelector('.quiz__option.is-wrong')).toBeNull();
  });

  it('leaves the author’s order alone when nothing was asked for', async () => {
    await render('none');

    expect(optionTexts()).toEqual(['right', 'wrong-1', 'wrong-2', 'wrong-3']);
  });

  /**
   * Reported from a reader: scrolling reshuffled the quiz.
   *
   * The reader shell re-renders as the page scrolls — it tracks which section
   * is in view — and an island that deals a new arrangement on every render
   * turns that into the questions visibly rearranging themselves under the
   * cursor. A hand is dealt per attempt, not per paint.
   *
   * Driven through `IslandHost` rather than the component, because the props
   * are only stable if the host keeps them stable; handing `data` straight to
   * the island would test a situation the reader never gets.
   */
  it('keeps its hand when the page merely re-renders', async () => {
    // Advancing, not constant: a stub that always returns the same number deals
    // the same permutation twice, so a quiz that re-deals on every render would
    // look stable and this test would pass against the bug it exists for.
    let calls = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (calls++ % 7) / 7);

    const config = JSON.stringify({ attributes: { shuffle: 'both' }, data: questions });
    // Built fresh each time: re-rendering the *same* element object lets React
    // skip the work entirely, which is not what scrolling does.
    const tree = () => (
      <BookProvider slug="demo" trusted registry={hosted}>
        <IslandHost type="quiz" islandId="q" config={config} />
      </BookProvider>
    );

    await act(async () => root.render(tree()));
    const first = optionTexts();

    // What a scroll does: the same content, rendered again.
    await act(async () => root.render(tree()));

    expect(optionTexts()).toEqual(first);
  });
});
