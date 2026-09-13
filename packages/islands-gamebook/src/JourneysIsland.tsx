import { unseenBetween } from './journey';
import { usePlaythrough } from './playthrough';
import { useBook, type IslandComponentProps } from '@smart-ebooks/engine';
import './gamebook.css';

/**
 * `::journeys` — the routes the reader has taken (SPEC011 QG16).
 *
 * A **record, not a second reading mode.** What the owner asked for was to know
 * what worked and what did not without having to memorise it: seeing that one
 * run went 1 → 2 → 4 → 6 and another 1 → 3 → 5 → 8 → 11 is enough to remember
 * the first and want to look again at the second.
 *
 * Where a journey ended needs no stored field and no authoring — it is the last
 * section of the route, and the reader recognises it because they read it. The
 * same reason K2.5 stopped storing the choice taken out of a visit.
 *
 * **The live route is navigable; earlier ones are not.** That is QG14 made
 * visible: a new journey does not inherit the previous one's access, so linking
 * an earlier route would offer doors the gate refuses.
 */
export default function JourneysIsland({ children }: IslandComponentProps) {
  const { linkTo } = useBook();
  const [play] = usePlaythrough();

  if (!play) return <>{children}</>;

  const earlier = [...play.closed].reverse();
  const missed = unseenBetween(play);
  const read = new Set([
    ...play.visits.map((visit) => visit.section),
    ...play.closed.flatMap((journey) => journey.visits.map((visit) => visit.section)),
  ]).size;

  return (
    <aside className="gamebook-journeys" aria-label="Your journeys">
      <p className="gamebook-journeys__title">Your journeys</p>
      <ol className="gamebook-journeys__list">
        <li>
          <span className="gamebook-journeys__label">This one</span>{' '}
          {play.visits.map((visit, index) => (
            <span key={visit.id}>
              {index > 0 ? ' → ' : ''}
              <a href={linkTo?.(visit.section) ?? `#${visit.section}`}>{visit.section}</a>
            </span>
          ))}
        </li>
        {earlier.map((journey, index) => (
          <li key={journey.at}>
            <span className="gamebook-journeys__label">
              {index === 0 && earlier.length > 1 ? 'The one before' : 'Earlier'}
            </span>{' '}
            <span className="gamebook-journeys__route">
              {journey.visits.map((visit) => visit.section).join(' → ')}
            </span>
          </li>
        ))}
      </ol>
      <p className="gamebook-journeys__seen">
        You have read {read} {read === 1 ? 'section' : 'sections'}
        {missed.length > 0 ? `, and have never seen ${missed.join(', ')}.` : '.'}
      </p>
    </aside>
  );
}
