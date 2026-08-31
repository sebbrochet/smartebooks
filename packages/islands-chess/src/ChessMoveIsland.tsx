import { useMemo, type ReactNode } from 'react';
import type { IslandComponentProps } from '@smart-ebooks/engine';
import { findByLabel } from './score';
import { useGame, useSequence } from './gameContext';
import './chess.css';

/**
 * A move named in the prose: `:move[2. Bc4]` (SPEC001 §4.1/P2.6, SPEC008 G4.1).
 *
 * The point of the whole container arrangement. A chess book says *"now 2. Bc4
 * eyes the weak f7 square"* in a sentence, and the reader should be able to
 * touch that move and see it — without the sentence being interrupted by a
 * board, a button bar or a box.
 *
 * The label is resolved against the game rather than being given a path,
 * because `at="0.0.1"` is not something anyone should have to write. If it
 * resolves to nothing — a typo, a move that is not in this game — the mark is
 * the plain text the author wrote, and the content linter is what complains.
 */
export default function ChessMoveIsland({ children }: IslandComponentProps) {
  const game = useGame();
  const sequence = useSequence();
  const label = useMemo(() => textOf(children), [children]);
  const path = game && label ? findByLabel(game.tree, label) : undefined;

  if (!sequence || !path) return <>{children}</>;

  const current = sequence.current === path;

  return (
    <button
      type="button"
      className="island-inline chess-move"
      aria-current={current ? 'true' : undefined}
      onClick={() => sequence.go(path)}
    >
      {children as ReactNode}
    </button>
  );
}

/**
 * The label as text. React children, not mdast: by the time an inline island
 * runs, its label has been compiled — so this walks elements rather than nodes.
 */
function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  const element = children as { props?: { children?: ReactNode } } | null;
  return element?.props?.children ? textOf(element.props.children) : '';
}
