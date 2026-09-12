import { useMemo, type ReactNode } from 'react';
import { attrText, useBook, type IslandComponentProps } from '@smart-ebooks/engine';
import { current, tookFrom } from './journey';
import { take, usePlaythrough } from './playthrough';
import './gamebook.css';

/**
 * `::choice{to="45"}` — the whole domain in one directive (SPEC011 K3.1).
 *
 * A gamebook is this island plus prose. It renders as a link that moves the
 * reader to section 45 and nowhere else, and its static form is
 * **`turn to 45`** — which is not an approximation of the printed book, it *is*
 * the printed book. Any design that cannot produce that line is wrong.
 *
 * Three rendered states, not one (§4.2b, QG12):
 *
 * - **offered**, in the section the reader is on — the only one that is a control;
 * - **taken**, in a section they have left, naming where it led;
 * - **refused**, in a section they have left, marked as the road not taken.
 *
 * The last two are prose about the reader's own history. Showing the road
 * refused is the richest part of rereading one of these books, and it is
 * something the printed original cannot do.
 */
export default function ChoiceIsland({ attributes, children }: IslandComponentProps) {
  const { unit, linkTo } = useBook();
  const [play, commit] = usePlaythrough();
  const to = attrText(attributes.to);

  const label = useMemo(() => textOf(children), [children]);
  const printed = label ? `${label} — turn to ${to}` : `turn to ${to}`;

  // Without a destination there is no choice to offer, and the prose the author
  // wrote is better than an error: the linter is what complains (K4.1).
  if (!to || !unit) return <>{printed}</>;

  // Nothing chosen yet means the reader is standing in the book's first
  // section, which is live by definition.
  const live = !play || current(play).section === unit;

  if (!live) {
    const index = play.visits.map((visit) => visit.section).lastIndexOf(unit);
    const taken = index >= 0 ? tookFrom(play.visits, index) === to : false;

    return (
      <span className={`gamebook-choice gamebook-choice--${taken ? 'taken' : 'refused'}`}>
        {printed}
        <span className="gamebook-choice__note">
          {taken ? ' (you went this way)' : ' (not taken)'}
        </span>
      </span>
    );
  }

  /*
   * A real link, not a click handler: keyboard-reachable, announced as a link,
   * and it survives the reader's own habits. The default is prevented only so
   * that the journey is written **before** the route changes — the gate is
   * asked about the destination the moment it arrives, and would refuse a
   * section the journey does not yet contain.
   */
  return (
    <a
      className="gamebook-choice gamebook-choice--offered"
      href={linkTo?.(to) ?? `#${to}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();

        const href = event.currentTarget.getAttribute('href') ?? '';
        void commit(take(play, unit, to)).then(() => {
          window.location.hash = href.replace(/^#/, '');
        });
      }}
    >
      {label ? (children as ReactNode) : `turn to ${to}`}
    </a>
  );
}

/** The label as text, walking compiled children rather than mdast (P2.6). */
function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  const element = children as { props?: { children?: ReactNode } } | null;
  return element?.props?.children ? textOf(element.props.children) : '';
}
