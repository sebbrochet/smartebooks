import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Named in the placeholder, so a reader can say which block failed. */
  type: string;
  /**
   * Inline islands live inside a paragraph, so their placeholder must be a
   * `span` — and it should be quiet, because a red box mid-sentence is worse
   * than the word it replaced.
   */
  inline?: boolean;
  children: ReactNode;
}

interface State {
  failed: boolean;
  cause: 'broken' | 'offline' | 'stale';
}

/**
 * Fired when an island's code is missing because the page is running a build
 * the server has moved on from. `useServiceWorker` listens for it.
 *
 * An event rather than a callback prop: the boundary wraps every island on the
 * page and knows nothing about the app around it, and the recovery — activating
 * the waiting worker — belongs to whoever registered it.
 */
export const STALE_BUILD_EVENT = 'smart-ebooks:stale-build';

/**
 * Whether this looks like code that never arrived rather than code that broke.
 *
 * Islands are `lazy`, so their component is a separate file fetched the first
 * time one is shown. Miss that fetch — a tunnel, a hotel wifi that resolves but
 * does not carry — and the import rejects and lands here, where it used to be
 * reported as `This chess-board could not be displayed`. That is the sentence
 * for a *broken* island, and it tells a reader nothing they can act on. "Needs
 * a connection the first time" is something they can act on.
 *
 * Two signals, because neither is sufficient. Browsers word a failed module
 * load differently and none of it is specified, so the message test is a union
 * of what Chromium, Firefox and WebKit actually say — it will miss a wording
 * nobody has seen yet. `navigator.onLine` catches those, but only when the
 * device knows it is offline, which in the case that prompted this it did not.
 *
 * Wrong in the safe direction: an island that genuinely threw while the reader
 * happened to be offline is described as needing a connection. They reload, and
 * then they see the honest message.
 */
function looksLikeMissingCode(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to fetch/i.test(
    message,
  );
}

/**
 * Whether the server answered a module request with something that is not a
 * module — which means the page is running a build that no longer exists.
 *
 * This is a *different* failure from a missing connection, and it was being
 * reported as neither. A deploy replaces content-hashed chunks and deletes the
 * old ones. A reader still running the previous shell — which is every reader
 * who has not accepted the update prompt — asks for a chunk by its old name,
 * and a static host answers a missing path with the SPA fallback: `index.html`,
 * as `text/html`. The module loader then complains about the MIME type, not
 * about the network, so none of the wordings above match and the reader is told
 * the island is broken. It is not; their copy of the app is stale.
 *
 * Observed, not guessed: `ChessGameIsland-chIHKmyi.js` returned 404 with
 * `content-type: text/html` from the live site while the current build was
 * asking for `ChessGameIsland-CRG_pFwF.js`.
 *
 * Unambiguous in a way an ordinary fetch failure is not: the server *answered*,
 * so connectivity is fine and the file is genuinely gone.
 */
function looksLikeStaleBuild(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // Chromium, Firefox and WebKit in that order.
  return /expected a javascript module script|disallowed mime type|is not a valid javascript mime type|failed to load module script/i.test(
    message,
  );
}

/**
 * Stops one broken island from taking the chapter with it.
 *
 * The platform's promise is that a reader never loses a page to a bad island:
 * an unknown directive renders a placeholder, a bad attribute falls back to its
 * default. That promise had a hole — those are *parse-time* protections, and an
 * exception thrown while an island renders or mounts propagates to the root and
 * unmounts the whole book. Found 2026-08-31, when one island passed a library
 * an explicitly-`undefined` option and every chapter containing it went blank.
 *
 * A class component because React offers no hook for this.
 */
export class IslandBoundary extends Component<Props, State> {
  state: State = { failed: false, cause: 'broken' };

  static getDerivedStateFromError(error: unknown): State {
    if (looksLikeStaleBuild(error)) return { failed: true, cause: 'stale' };
    return { failed: true, cause: looksLikeMissingCode(error) ? 'offline' : 'broken' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The placeholder is deliberately vague; this is where the detail goes, for
    // whoever can act on it.
    console.error(`Island "${this.props.type}" failed to render.`, error, info.componentStack);

    /*
     * Any island whose *code* failed to arrive, on a device that believes it is
     * online, may be running against a build the server has replaced.
     *
     * Deliberately not decided from the error text. Hosts answer a deleted
     * chunk differently — a real 404 gives "failed to fetch dynamically
     * imported module", an SPA fallback gives a MIME complaint — and an earlier
     * version of this only recognised the second, so the first went
     * unrecovered. The wording cannot settle it, so the boundary reports the
     * *symptom* and `useServiceWorker` checks the one thing that can: whether a
     * newer worker actually installs. Nothing happens if none does.
     */
    if (this.state.cause !== 'broken' && typeof navigator !== 'undefined') {
      if (navigator.onLine !== false) window.dispatchEvent(new CustomEvent(STALE_BUILD_EVENT));
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.inline) {
      return <span className="island-inline island-inline--failed" role="note" />;
    }
    return (
      <div className="island island--unknown" role="note">
        {this.state.cause === 'offline' && (
          <>
            This <code>{this.props.type}</code> needs a connection the first time it is shown. The
            text of this book is already on your device.
          </>
        )}
        {this.state.cause === 'stale' && (
          <>
            This <code>{this.props.type}</code> is not in the version of the reader this page is
            running. A newer one has been published — the page will update itself in a moment.
          </>
        )}
        {this.state.cause === 'broken' && (
          <>
            This <code>{this.props.type}</code> could not be displayed.
          </>
        )}
      </div>
    );
  }
}
