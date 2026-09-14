import { type ReactNode } from 'react';
import { attrText, useBook, type IslandComponentProps } from '@smart-ebooks/engine';
import { restart } from './journey';
import { usePlaythrough } from './playthrough';
import { wordsFor } from './words';
import './gamebook.css';

/**
 * `:restart{to="1"}` — begin again (SPEC011 K2.3).
 *
 * Death is a normal outcome in this domain and reaching an ending is the point
 * of it, so a reader must be able to start over **without clearing site data**.
 * The library's per-book reset does exist and is the right tool for *forgetting*
 * a book; this is the other promise, and it keeps what came before as a closed
 * attempt rather than destroying it.
 *
 * Placed by the book rather than offered by the shell, because only the book
 * knows where its endings are and what "again" means — and because a reader
 * shell that learned about playthroughs would be carrying one domain's idea for
 * every other domain to step around.
 *
 * `to` is explicit for the same reason. An author may legitimately send a
 * second run somewhere other than section one, and nothing else in the book
 * knows which section is its first.
 */
export default function RestartIsland({ attributes, children }: IslandComponentProps) {
  const { linkTo, language } = useBook();
  const [play, commit] = usePlaythrough();
  const to = attrText(attributes.to);

  const label = textOf(children) || wordsFor(language).beginAgain;

  // Nothing to restart before the reader has chosen anything, and nowhere to
  // send them without a destination. The prose the author wrote is the fallback.
  if (!to || !play) return <>{label}</>;

  return (
    <a
      className="gamebook-choice gamebook-restart"
      href={linkTo?.(to) ?? `#${to}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();

        const href = event.currentTarget.getAttribute('href') ?? '';
        void commit(restart(play, to)).then(() => {
          window.location.hash = href.replace(/^#/, '');
        });
      }}
    >
      {label}
    </a>
  );
}

function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  const element = children as { props?: { children?: ReactNode } } | null;
  return element?.props?.children ? textOf(element.props.children) : '';
}
