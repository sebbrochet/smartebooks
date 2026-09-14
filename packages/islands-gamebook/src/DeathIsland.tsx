import { type ReactNode } from 'react';
import { attrText, useBook, type IslandComponentProps } from '@smart-ebooks/engine';
import { respawn } from './journey';
import { usePlaythrough } from './playthrough';
import { wordsFor } from './words';
import './gamebook.css';

/**
 * `:death[…]{to="4"}` — the reader's journey ends, and the book says where to
 * pick it up again (SPEC011 §4 rule 6, QG11).
 *
 * **The reader turns back; nothing turns back for them.** A printed gamebook
 * says *"your adventure ends here; return to 112"*, and that is also the only
 * safe shape here — truncating the journey as a side effect of *rendering* the
 * section would fire again on any re-render and would make re-reading your own
 * death destroy it.
 *
 * Taking it calls `respawn`, which slices the journey back to `to` and keeps
 * what came after as a closed journey: the reader can still read how they died
 * (QG9), and the character sheet rolls back for free because each entry
 * carries its own snapshot (K2.6, QG10).
 */
export default function DeathIsland({ attributes, children }: IslandComponentProps) {
  const { linkTo, language } = useBook();
  const [play, commit] = usePlaythrough();
  const to = attrText(attributes.to);
  const words = wordsFor(language);

  const label = (children as ReactNode) ?? words.storyEnds;

  // Without a destination there is nowhere to send them, and without a journey
  // there is nothing to truncate. The linter is what complains (K4.6).
  if (!to || !play) return <span className="gamebook-ending">{label}</span>;

  return (
    <span className="gamebook-ending gamebook-death">
      {label}{' '}
      <a
        className="gamebook-choice gamebook-choice--offered"
        href={linkTo?.(to) ?? `#${to}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();

          const href = event.currentTarget.getAttribute('href') ?? '';
          void commit(respawn(play, to)).then(() => {
            window.location.hash = href.replace(/^#/, '');
          });
        }}
      >
        {words.returnTo(to)}
      </a>
    </span>
  );
}
