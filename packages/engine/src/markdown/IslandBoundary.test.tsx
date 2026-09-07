// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { IslandBoundary, STALE_BUILD_EVENT } from './IslandBoundary';

/**
 * The platform promises a reader never loses a page to a bad island. That was
 * only true of *parse-time* failures — an unknown directive, a bad attribute.
 * An island that threw while mounting unmounted the whole book, which is how a
 * one-line mistake in the chess pack blanked every chapter containing a puzzle.
 */
function Boom(): never {
  throw new Error('island exploded');
}

/** What a browser throws when a `lazy` island's chunk never arrives. */
function Missing(): never {
  throw new Error('Failed to fetch dynamically imported module: /assets/ChessBoardIsland.js');
}

/**
 * What a browser throws when the chunk's *name* is gone.
 *
 * A deploy replaces content-hashed chunks and deletes the old ones, so a reader
 * still running the previous shell asks for a name that no longer exists — and
 * a static host answers a missing path with the SPA fallback, as `text/html`.
 * Verified against the live site: `ChessGameIsland-chIHKmyi.js` returned 404
 * with `content-type: text/html` while the current build wanted
 * `ChessGameIsland-CRG_pFwF.js`.
 */
function Stale(): never {
  throw new Error(
    'Failed to load module script: Expected a JavaScript module script but the server responded ' +
      'with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts ' +
      'per HTML spec.',
  );
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

  /*
   * An island's component is a separate file, fetched the first time one is
   * shown. Miss that fetch and the reader was told the block "could not be
   * displayed" — the sentence for a broken island, and nothing they can act
   * on. They can act on "needs a connection".
   */
  it('says a missing chunk needs a connection, not that the island is broken', () => {
    show(
      <IslandBoundary type="chess-board">
        <Missing />
      </IslandBoundary>,
    );

    expect(container.textContent).toContain('needs a connection the first time');
    // And says the part that is *not* at risk, because the reader has just
    // watched half the page render.
    expect(container.textContent).toContain('already on your device');
    expect(container.textContent).not.toContain('could not be displayed');
  });

  it('still says an island is broken when it is', () => {
    show(
      <IslandBoundary type="quiz">
        <Boom />
      </IslandBoundary>,
    );

    expect(container.textContent).toContain('could not be displayed');
    expect(container.textContent).not.toContain('needs a connection');
  });

  /*
   * The failure that sent a whole book's worth of boards to the least useful
   * message there is. The reader is online, the server answered, and the island
   * is fine — their copy of the app is the thing that is out of date. Told "it
   * could not be displayed", they have nothing to act on; told the truth, the
   * app can act for them.
   */
  describe('a chunk the server no longer has', () => {
    const WORDINGS = {
      Chromium:
        'Failed to load module script: Expected a JavaScript module script but the server ' +
        'responded with a MIME type of "text/html".',
      Firefox:
        'Loading module from "https://example.com/assets/ChessGameIsland-chIHKmyi.js" was ' +
        'blocked because of a disallowed MIME type ("text/html").',
      WebKit: "'text/html' is not a valid JavaScript MIME type.",
    };

    for (const [browser, message] of Object.entries(WORDINGS)) {
      it(`is named as a stale build, not a broken island (${browser})`, () => {
        const Throwing = (): never => {
          throw new Error(message);
        };
        show(
          <IslandBoundary type="chess-game">
            <Throwing />
          </IslandBoundary>,
        );

        expect(container.textContent).toContain('not in the version of the reader');
        expect(container.textContent).not.toContain('could not be displayed');
        // Not a connection problem: the server answered, it just answered HTML.
        expect(container.textContent).not.toContain('needs a connection');
      });
    }

    // Nothing the reader can do fixes this — a reload is served the same cached
    // shell — so the boundary has to tell the part of the app that can.
    it('asks the app to replace the stale worker', () => {
      const heard = vi.fn();
      window.addEventListener(STALE_BUILD_EVENT, heard);

      show(
        <IslandBoundary type="chess-game">
          <Stale />
        </IslandBoundary>,
      );

      expect(heard).toHaveBeenCalledTimes(1);
      window.removeEventListener(STALE_BUILD_EVENT, heard);
    });

    /*
     * The wording cannot be trusted to decide this, which an e2e run proved:
     * a host that answers a deleted chunk with a real 404 produces the ordinary
     * "failed to fetch" error, and an earlier version of this only reported the
     * MIME one — so on that host the page never recovered at all.
     *
     * So any missing code on a device that believes it is online is reported,
     * and `useServiceWorker` settles it by seeing whether a newer worker
     * actually installs.
     */
    it('reports a plain 404 too, not only the MIME complaint', () => {
      const heard = vi.fn();
      window.addEventListener(STALE_BUILD_EVENT, heard);

      show(
        <IslandBoundary type="chess-game">
          <Missing />
        </IslandBoundary>,
      );

      expect(heard).toHaveBeenCalledTimes(1);
      window.removeEventListener(STALE_BUILD_EVENT, heard);
    });

    it('says nothing to the app when the device knows it is offline', () => {
      const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const heard = vi.fn();
      window.addEventListener(STALE_BUILD_EVENT, heard);

      show(
        <IslandBoundary type="chess-game">
          <Missing />
        </IslandBoundary>,
      );

      // There is no newer build to fetch on a train, and asking would only
      // cost the reader a pointless reload.
      expect(heard).not.toHaveBeenCalled();
      expect(container.textContent).toContain('needs a connection');
      window.removeEventListener(STALE_BUILD_EVENT, heard);
      online.mockRestore();
    });

    it('says nothing to the app when an island simply broke', () => {
      const heard = vi.fn();
      window.addEventListener(STALE_BUILD_EVENT, heard);

      show(
        <IslandBoundary type="quiz">
          <Boom />
        </IslandBoundary>,
      );

      expect(heard).not.toHaveBeenCalled();
      window.removeEventListener(STALE_BUILD_EVENT, heard);
    });
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
