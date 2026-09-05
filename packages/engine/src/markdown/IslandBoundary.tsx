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
  missingCode: boolean;
}

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
  state: State = { failed: false, missingCode: false };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, missingCode: looksLikeMissingCode(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The placeholder is deliberately vague; this is where the detail goes, for
    // whoever can act on it.
    console.error(`Island "${this.props.type}" failed to render.`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.inline) {
      return <span className="island-inline island-inline--failed" role="note" />;
    }
    return (
      <div className="island island--unknown" role="note">
        {this.state.missingCode ? (
          <>
            This <code>{this.props.type}</code> needs a connection the first time it is shown. The
            text of this book is already on your device.
          </>
        ) : (
          <>
            This <code>{this.props.type}</code> could not be displayed.
          </>
        )}
      </div>
    );
  }
}
