import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { IslandComponentProps } from '../types';
import { useBook } from '../reader/BookContext';
import { isHttpsUrl } from './mediaUrl';
import { attrText } from './attributes';
import { MediaProvider, SequenceProvider } from './mediaContext';
import { markAt, positionOf, type TimeMark } from './timedMedia';
import './timedMedia.css';

/** Sound files get an `<audio>`; everything else gets a `<video>`. */
const SOUND = /\.(mp3|m4a|wav|oga|ogg|opus|flac|aac)(\?|#|$)/i;

/**
 * A recording with the author's prose written around it (SPEC012 §4.1).
 *
 * It owns the player, the clock and the current mark, and publishes the last
 * two through a sequence its children consume — so `:at[1:24]` in a sentence
 * seeks the recording, and `::media-marks` follows it.
 *
 * **The player is chrome, not content**, which is SPEC008 §4.13's conclusion
 * applied to a second domain rather than restated. A player sitting in the flow
 * of the prose that drives it is a player the reader scrolls away from, and no
 * amount of `position: sticky` fixes that — so the container renders it, in a
 * region of its own above a pane that holds the author's words.
 *
 * **The clock is sampled continuously and published discretely.** `timeupdate`
 * fires about four times a second; the mark changes when the author said it
 * does. Only the second of those reaches the context, which is what keeps a
 * transcript of two hundred marks from re-rendering four times a second — and
 * what lets `createSequence` stay exactly as chess left it (SPEC012 §2.3).
 */
export default function MediaLessonIsland({
  attributes,
  packagedAssets,
  data,
  children,
}: IslandComponentProps) {
  const { trusted } = useBook();
  const src = attrText(attributes.src);
  const poster = attrText(attributes.poster);
  const marks = useMemo(() => (data as { marks?: TimeMark[] })?.marks ?? [], [data]);

  const player = useRef<HTMLMediaElement | null>(null);
  const [current, setCurrent] = useState('');

  /*
   * Which side moved last, and a ref rather than state because the guard itself
   * must never cause a render.
   *
   * Seeking from the prose makes the player report a new time, which would
   * immediately drive the mark from the seek that the mark caused. The prior art
   * solved this with a directional flag on a short timer and nothing has
   * improved on it (SPEC012 §2.5).
   */
  const drivenByProse = useRef(false);
  const settle = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  const go = useCallback((position: string) => {
    const at = Number(position);
    if (!Number.isFinite(at)) return;

    drivenByProse.current = true;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      drivenByProse.current = false;
    }, 500);

    setCurrent(position);
    const element = player.current;
    if (!element) return;
    element.currentTime = at;
    // A reader who touched a moment asked to hear it. `play()` rejects when the
    // browser wants a gesture first, and this *is* one — but a rejection here
    // must not take the page down with it.
    void element.play?.().catch(() => undefined);
  }, []);

  const onTimeUpdate = useCallback(() => {
    if (drivenByProse.current) return;
    const element = player.current;
    if (!element) return;

    // `setState` with an unchanged value is a bail-out in React, so this is the
    // publish-on-change rule and costs nothing to state twice.
    const next = positionOf(markAt(marks, element.currentTime));
    setCurrent((previous) => (previous === next ? previous : next));
  }, [marks]);

  const positions = useMemo(() => marks.map((mark) => String(mark.at)), [marks]);
  const lesson = useMemo(() => ({ marks, ready: Boolean(src) }), [marks, src]);

  if (!src) {
    return (
      <div className="island island--unknown" role="note">
        A media lesson is missing a <code>src</code>.
      </div>
    );
  }

  // The same rule the plain media islands apply: an imported book may point at
  // a file it packaged or at https, and nothing else (SPEC001 L19).
  if (!trusted && !packagedAssets.includes('src') && !isHttpsUrl(src)) {
    return (
      <div className="island island--disabled" role="note">
        Media source blocked in an imported book.
      </div>
    );
  }

  const sound = SOUND.test(src);
  const Element = sound ? 'audio' : 'video';

  return (
    <MediaProvider value={lesson}>
      <SequenceProvider positions={positions} current={current} onGo={go}>
        {/*
         * `ui-scroll-pane` on both, for the reason SPEC008 G9.1 gives: the class
         * marks *this clips on screen*, and a height budget that bounds a
         * scrolling child clips exactly as surely as the child does. Print
         * releases both.
         */}
        <div className="media-lesson ui-scroll-pane" data-testid="media-lesson">
          <div className={`media-lesson__player media-lesson__player--${Element}`}>
            <Element
              ref={player as never}
              src={src}
              poster={sound ? undefined : poster || undefined}
              controls
              preload="metadata"
              data-testid="media-lesson-player"
              onTimeUpdate={onTimeUpdate}
              onSeeked={onTimeUpdate}
            />
          </div>
          <div className="media-lesson__prose ui-scroll-pane" data-testid="media-lesson-prose">
            {children as ReactNode}
          </div>
        </div>
      </SequenceProvider>
    </MediaProvider>
  );
}
