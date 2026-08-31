import { useId, useState, type ReactNode } from 'react';
import { attrText, type IslandComponentProps } from '../index';

/**
 * A glossary term, marked inside a sentence (SPEC001 P2.6).
 *
 * The first **inline** island, and the one that proves the shape: fiction wants
 * `:character[Vetinari]`, travel guides want `:place[Café Central]`, chess wants
 * `:move[1. e4]`. All of them are a word in a sentence that does something when
 * you touch it, and none of them may interrupt the prose to do it — a box in
 * the middle of a paragraph is exactly what a reader of a novel does not want.
 *
 * Rendered as a `button`, not a `span` with a click handler: it is operable by
 * keyboard, announced as interactive, and says whether it is open. With the
 * interactivity stripped it is the word the author wrote, which is what a
 * printed glossary term looks like.
 */
export function TermIsland({ attributes, children }: IslandComponentProps) {
  const definition = attrText(attributes.definition);
  const [open, setOpen] = useState(false);
  const panel = useId();

  // No definition is not an error worth interrupting a sentence for. The word
  // is the content; without an explanation there is simply nothing to open.
  if (!definition) return <>{children}</>;

  return (
    <span className="island-inline island-term">
      <button
        type="button"
        className="island-term__word"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((value) => !value)}
      >
        {children as ReactNode}
      </button>
      {open && (
        <span className="island-term__definition" id={panel} role="note">
          {definition}
        </span>
      )}
    </span>
  );
}
