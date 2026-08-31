import { useMemo, useState } from 'react';
import type { IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { useBook } from '../reader/BookContext';
import { isHttpsUrl } from './mediaUrl';
import { attrText } from './attributes';

/**
 * Convert a YouTube watch/short URL into an embeddable URL. Returns null for
 * non-YouTube sources, which are rendered with a native <video> element.
 *
 * **`youtube-nocookie.com`, not `youtube.com`.** YouTube's privacy-enhanced
 * host does not set its tracking cookies unless the viewer actually plays the
 * video. Same player, same API, no functional difference — it was only ever
 * `youtube.com` here because that is what the first implementation typed.
 */
function toYouTubeEmbed(src: string): string | null {
  const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;
  try {
    const url = new URL(src);
    if (url.hostname === 'youtu.be') {
      return embed(url.pathname.slice(1));
    }
    if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
      const id = url.searchParams.get('v');
      if (id) return embed(id);
      if (url.pathname.startsWith('/embed/')) return embed(url.pathname.slice('/embed/'.length));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Embedded video island. Supports YouTube URLs (iframe) and direct media files
 * (native <video>). Records a local "watched" flag when playback starts.
 *
 * **Nothing is requested until the reader asks for it.** A YouTube embed used
 * to be rendered with the chapter, so opening a page with three videos
 * announced the reader to Google three times before they touched anything —
 * and cost a megabyte or so of third-party script per video. The iframe is now
 * created on click, and the placeholder before it is drawn locally: no
 * thumbnail is fetched, because fetching one from `i.ytimg.com` would make the
 * request this exists to avoid.
 */
export function VideoIsland({ id, attributes, packagedAssets }: IslandComponentProps) {
  const { trusted } = useBook();
  const src = attrText(attributes.src);
  const title = attrText(attributes.title, 'Video');
  const fromPackage = packagedAssets.includes('src');
  const embed = useMemo(() => toYouTubeEmbed(src), [src]);
  const [watched, setWatched] = usePersistentState<boolean>(`media:${id}`, false);
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className="island island--video island--unknown" role="note">
        Video is missing a <code>src</code>.
      </div>
    );
  }

  // In imported books, only packaged assets, youtube embeds, or https files are allowed.
  if (!trusted && !embed && !fromPackage && !isHttpsUrl(src)) {
    return (
      <div className="island island--video island--disabled" role="note">
        Video source blocked in an imported book.
      </div>
    );
  }

  // The click that loads the embed is also the click that plays it, so
  // `autoplay=1` is what makes one press do one thing rather than two.
  function play() {
    setLoaded(true);
    setWatched(true);
  }

  return (
    <figure className={`island island--video ${watched ? 'is-watched' : ''}`}>
      {embed ? (
        <div className="video__frame">
          {loaded ? (
            <iframe
              src={`${embed}?autoplay=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              className="video__facade"
              onClick={play}
              aria-label={`Play ${title} (loads from YouTube)`}
            >
              <span className="video__play" aria-hidden="true" />
              <span className="video__notice">Loads from YouTube when you press play</span>
            </button>
          )}
        </div>
      ) : (
        // A packaged or direct file: `preload="none"` so the bytes are fetched
        // on demand, and `onPlay` already meant what it says.
        <video controls preload="none" src={src} onPlay={() => setWatched(true)}>
          <track kind="captions" />
        </video>
      )}
      <figcaption>{title}</figcaption>
    </figure>
  );
}
