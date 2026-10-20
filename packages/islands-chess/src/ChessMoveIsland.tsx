import { useMemo, type ReactNode } from 'react';
import { attrText, type IslandComponentProps } from '@smart-ebooks/engine';
import { resolveMoveReference } from './score';
import { allNodes } from './tree';
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
export default function ChessMoveIsland({ children, attributes }: IslandComponentProps) {
  const game = useGame();
  const sequence = useSequence();
  const label = useMemo(() => textOf(children), [children]);
  const line = attributes.line === undefined ? undefined : attrText(attributes.line);
  const result = useMemo(
    () => (game && label ? resolveMoveReference(allNodes(game.tree), label, line) : undefined),
    [game, label, line],
  );

  if (!game || !sequence || result?.status !== 'resolved') {
    return line === undefined ? (
      <>{children}</>
    ) : (
      <span title="This line does not select one move in the game.">{children}</span>
    );
  }

  const { path } = result;
  const current = sequence.current === path && (line === undefined || game.line === result.line);

  return (
    <button
      type="button"
      className="island-inline chess-move"
      aria-current={current ? 'true' : undefined}
      onClick={() =>
        result.line === undefined ? sequence.go(path) : game.selectLine(path, result.line)
      }
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
