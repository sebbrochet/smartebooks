// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { IslandBoundary } from './IslandBoundary';

/**
 * The platform promises a reader never loses a page to a bad island. That was
 * only true of *parse-time* failures — an unknown directive, a bad attribute.
 * An island that threw while mounting unmounted the whole book, which is how a
 * one-line mistake in the chess pack blanked every chapter containing a puzzle.
 */
function Boom(): never {
  throw new Error('island exploded');
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // React logs the caught error itself; the test asserts on our own call.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const show = (node: React.ReactNode) => act(() => root.render(node));

describe('IslandBoundary', () => {
  it('renders its island when nothing goes wrong', () => {
    show(
      <IslandBoundary type="quiz">
        <p>the quiz</p>
      </IslandBoundary>,
    );
    expect(container.textContent).toContain('the quiz');
  });

  it('replaces a throwing island with a placeholder instead of losing the page', () => {
    show(
      <div>
        <p>the chapter</p>
        <IslandBoundary type="chess-puzzle">
          <Boom />
        </IslandBoundary>
      </div>,
    );

    // The rest of the chapter survives — that is the whole point.
    expect(container.textContent).toContain('the chapter');
    expect(container.textContent).toContain('could not be displayed');
    expect(container.textContent).toContain('chess-puzzle');
  });

  // A silent placeholder helps the reader and no one else; the detail has to
  // reach whoever can act on it.
  it('reports the failure, naming the island', () => {
    show(
      <IslandBoundary type="chess-puzzle">
        <Boom />
      </IslandBoundary>,
    );
    const logged = vi.mocked(console.error).mock.calls;
    expect(logged.some((call) => String(call[0]).includes('chess-puzzle'))).toBe(true);
  });
});
