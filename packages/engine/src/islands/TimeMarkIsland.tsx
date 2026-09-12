import { useMemo, type ReactNode } from 'react';
import type { IslandComponentProps } from '../types';
import { useMediaLesson, useSequence } from './mediaContext';
import { parseTime } from './timedMedia';
import './timedMedia.css';

/**
 * A moment named in the prose: `:at[1:24]` (SPEC012 §4.2).
 *
 * The counterpart of chess's `:move[2. Bc4]`, and the reason this island exists
 * at all: a book about a recording says *"the argument turns at 1:24"* in a
 * sentence, and the reader should be able to touch that and hear it — without
 * the sentence being interrupted by a player.
 *
 * The time is resolved against the container's declared marks rather than
 * seeking blind, so `:at[9:99]` or a moment the author never marked is the
 * plain text they wrote. That is SPEC001 P1.2's rule — the runtime is forgiving,
 * the linter is where it is reported — and SPEC008 C14 is the standing reminder
 * that the linter half is the half that gets forgotten.
 */
export default function TimeMarkIsland({ children }: IslandComponentProps) {
  const lesson = useMediaLesson();
  const sequence = useSequence();
  const label = useMemo(() => textOf(children), [children]);

  const at = parseTime(label);
  const mark = at === undefined ? undefined : lesson?.marks.find((entry) => entry.at === at);

  if (!sequence || !mark) return <>{children}</>;

  const position = String(mark.at);

  return (
    <button
      type="button"
      className="island-inline media-mark"
      aria-current={sequence.current === position ? 'true' : undefined}
      // The mark says a time; the label the author gave that moment is what
      // makes it worth touching, so it goes to anyone who cannot see the prose.
      aria-label={`${label} — ${mark.label}`}
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
