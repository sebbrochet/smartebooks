import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attrText, useMessages, type IslandComponentProps } from '@smart-ebooks/engine';
import { notesOf } from './notes';
import { canPlay, playNotes, type Playing } from './player';
import { useAbcSource } from './useAbcSource';
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
export default function MusicPieceIsland({
  attributes,
  data,
  children,
  packagedAssets,
}: IslandComponentProps) {
  const words = useMessages();
  const host = useRef<HTMLDivElement>(null);
  const playing = useRef<Playing | undefined>(undefined);
  const [current, setCurrent] = useState(START);
  const [sounding, setSounding] = useState(false);
  const body = ((data as { abc?: string })?.abc ?? '').trim();
  const { source, loading } = useAbcSource(attributes, packagedAssets, body);
  const abc = source.trim();
  const width = Number(attributes.width) || 520;
  const caption = attrText(attributes.caption).trim();
  const wanted = attributes.play !== false;

  const notes = useMemo(() => (abc ? notesOf(abc) : []), [abc]);
  const positions = useMemo(() => notes.map((note) => String(note.index)), [notes]);
  const piece = useMemo(() => ({ notes }), [notes]);

  const stop = useCallback(() => {
    playing.current?.stop();
    playing.current = undefined;
  }, []);

  // Nothing should still be making a noise after the reader has turned the page.
  useEffect(() => stop, [stop]);

  const toggle = useCallback(() => {
    if (playing.current) {
      stop();
      return;
    }
    setSounding(true);
    playing.current = playNotes(
      notes,
      (index) => setCurrent(index === undefined ? START : String(index)),
      () => {
        playing.current = undefined;
        setSounding(false);
      },
    );
  }, [notes, stop]);

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

  // A file still being read is not a broken piece.
  if (loading) return <div className="island island--music island--piece" aria-busy="true" />;

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
            <figcaption>
              <span>{caption || words.musicFigure}</span>
              {wanted && canPlay() && notes.length > 0 && (
                <button type="button" className="music__play" onClick={toggle}>
                  {sounding ? words.musicStop : words.musicPlay}
                </button>
              )}
            </figcaption>
          </figure>
          <div className="music__prose">{children}</div>
        </div>
      </SequenceProvider>
    </PieceProvider>
  );
}
