import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Named in the placeholder, so a reader can say which block failed. */
  type: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
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
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The placeholder is deliberately vague; this is where the detail goes, for
    // whoever can act on it.
    console.error(`Island "${this.props.type}" failed to render.`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="island island--unknown" role="note">
        This <code>{this.props.type}</code> could not be displayed.
      </div>
    );
  }
}
