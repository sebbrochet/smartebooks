import { useEffect, useRef, useState } from 'react';
import { attrText, useMessages, type IslandComponentProps } from '@smart-ebooks/engine';
import './music.css';

/**
 * A printed music example: engraved, silent, and with nothing to remember.
 *
 * The chess pack's diagram island is the model (SPEC008 §4.14) — most of what a
 * book about notation contains is a two-bar example that should not play,
 * scroll or save anything.
 *
 * `abcjs` is imported inside the effect rather than at module scope so the
 * engraver is fetched only when a figure is actually on the page.
 */
export default function MusicFigureIsland({ attributes, data }: IslandComponentProps) {
  const words = useMessages();
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const abc = ((data as { abc?: string })?.abc ?? '').trim();
  const caption = attrText(attributes.caption).trim();
  const width = Number(attributes.width) || 520;

  useEffect(() => {
    if (!abc) return;
    let cancelled = false;

    void (async () => {
      try {
        const { renderAbc } = await import('abcjs');
        if (cancelled || !host.current) return;
        renderAbc(host.current, abc, {
          responsive: 'resize',
          staffwidth: width,
          paddingtop: 0,
          paddingbottom: 0,
          // The notes take the page's text colour, so a figure read at night is
          // not black ink on a dark page.
          foregroundColor: 'currentColor',
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [abc, width]);

  if (!abc || failed) {
    return (
      <div className="island island--music island--unknown" role="note">
        {words.islandBroken}
      </div>
    );
  }

  return (
    <figure className="island island--music">
      <div className="music__stave" ref={host} aria-hidden="true" />
      {/* The engraving is decorative to a screen reader; the caption is the
          accessible name, which is why a figure without one still says what it
          is rather than announcing a wall of SVG. */}
      <figcaption>{caption || words.musicFigure}</figcaption>
    </figure>
  );
}
