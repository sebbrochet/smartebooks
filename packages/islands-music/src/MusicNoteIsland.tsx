import { useMemo, type ReactNode } from 'react';
import type { IslandComponentProps } from '@smart-ebooks/engine';
import { findNote } from './notes';
import { usePiece, useSequence } from './musicContext';
import './music.css';

/**
 * A note named in the prose: `:note[G]` (SPEC017 §6, SPEC001 P2.6).
 *
 * The point of the container arrangement, and the same point the chess pack
 * makes: a book says *"the leap to the high G is what makes the phrase"* in a
 * sentence, and the reader should be able to touch that note and see where it
 * is — without the sentence being interrupted by a stave.
 *
 * Unresolved marks are the plain text the author wrote, exactly as a mistyped
 * `:move` is: the reader never loses the sentence to a typo, and the linter is
 * what complains.
 */
export default function MusicNoteIsland({ attributes, children }: IslandComponentProps) {
  const piece = usePiece();
  const sequence = useSequence();
  const label = useMemo(() => textOf(children), [children]);
  const nth = Number(attributes.nth) || 1;
  const index = piece && label ? findNote(piece.notes, label, nth) : undefined;

  if (!sequence || index === undefined) return <>{children}</>;

  const position = String(index);
  const current = sequence.current === position;

  return (
    <button
      type="button"
      className="island-inline music-note"
      aria-current={current ? 'true' : undefined}
      onClick={() => sequence.go(position)}
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
