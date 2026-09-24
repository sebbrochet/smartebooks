import { useEffect, useMemo, useRef, useState } from 'react';
import { attrText, useMessages, type IslandComponentProps } from '@smart-ebooks/engine';
import { notesOf } from './notes';
import { PieceProvider, SequenceProvider } from './musicContext';
import './music.css';

/** Nothing is on show until the reader touches a mark. `''` is a real place. */
const START = '';

/**
 * A piece with the prose written around it (SPEC017 §6, SPEC008 §4.13).
 *
 * One score that holds still above, the author's prose below, and the notes
 * named in that prose able to point at it. The chess pack found the markup
 * decision the hard way and there is only one answer: the container renders the
 * score itself, because *the score is chrome, not content* — it is not
 * something the author places in the flow.
 */
export default function MusicPieceIsland({ attributes, data, children }: IslandComponentProps) {
  const words = useMessages();
  const host = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(START);
  const abc = ((data as { abc?: string })?.abc ?? '').trim();
  const width = Number(attributes.width) || 520;
  const caption = attrText(attributes.caption).trim();

  const notes = useMemo(() => (abc ? notesOf(abc) : []), [abc]);
  const positions = useMemo(() => notes.map((note) => String(note.index)), [notes]);
  const piece = useMemo(() => ({ notes }), [notes]);

  useEffect(() => {
    if (!abc) return;
    let cancelled = false;

    void (async () => {
      const { renderAbc } = await import('abcjs');
      if (cancelled || !host.current) return;
      renderAbc(host.current, abc, {
        responsive: 'resize',
        staffwidth: width,
        paddingtop: 0,
        paddingbottom: 0,
        foregroundColor: 'currentColor',
        // The drawn notes carry classes, which is what lets a mark in the prose
        // find the one it names without the engraver being asked again.
        add_classes: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [abc, width]);

  // Highlighting is a DOM concern rather than a re-render: the engraving is
  // abcjs's, and redrawing the whole score to move a marker would throw away
  // its layout for every click.
  useEffect(() => {
    const drawn = host.current?.querySelectorAll('.abcjs-note');
    if (!drawn) return;
    const index = current ? Number(current) - 1 : -1;
    drawn.forEach((element, position) => {
      element.classList.toggle('is-current', position === index);
    });
  }, [current, notes]);

  if (!abc) {
    return (
      <div className="island island--music island--unknown" role="note">
        {words.islandBroken}
      </div>
    );
  }

  return (
    <PieceProvider value={piece}>
      <SequenceProvider positions={positions} current={current} onGo={setCurrent}>
        <div className="island island--music island--piece">
          <figure className="music__score">
            <div className="music__stave" ref={host} aria-hidden="true" />
            <figcaption>{caption || words.musicFigure}</figcaption>
          </figure>
          <div className="music__prose">{children}</div>
        </div>
      </SequenceProvider>
    </PieceProvider>
  );
}
