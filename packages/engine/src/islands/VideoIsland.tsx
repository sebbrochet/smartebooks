import { useMemo } from 'react';
import type { IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { useBook } from '../reader/BookContext';
import { isHttpsUrl } from './mediaUrl';
import { attrText } from './attributes';

/**
 * Convert a YouTube watch/short URL into an embeddable URL. Returns null for
 * non-YouTube sources, which are rendered with a native <video> element.
 */
function toYouTubeEmbed(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    }
    if (url.hostname.endsWith('youtube.com')) {
      const id = url.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (url.pathname.startsWith('/embed/')) return src;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Embedded video island. Supports YouTube URLs (iframe) and direct media files
 * (native <video>). Records a local "watched" flag when playback starts.
 */
export function VideoIsland({ id, attributes }: IslandComponentProps) {
  const { trusted, resolveAsset } = useBook();
  const src = attrText(attributes.src);
  const title = attrText(attributes.title, 'Video');
  const resolvedAsset = src.startsWith('assets/') ? resolveAsset?.(src) : undefined;
  const effectiveSrc = resolvedAsset ?? src;
  const embed = useMemo(() => toYouTubeEmbed(effectiveSrc), [effectiveSrc]);
  const [watched, setWatched] = usePersistentState<boolean>(`media:${id}`, false);

  if (!src) {
    return (
      <div className="island island--video island--unknown" role="note">
        Video is missing a <code>src</code>.
      </div>
    );
  }

  // In imported books, only packaged assets, youtube embeds, or https files are allowed.
  if (!trusted && !embed && !resolvedAsset && !isHttpsUrl(src)) {
    return (
      <div className="island island--video island--disabled" role="note">
        Video source blocked in an imported book.
      </div>
    );
  }

  return (
    <figure className={`island island--video ${watched ? 'is-watched' : ''}`}>
      {embed ? (
        <div className="video__frame">
          <iframe
            src={embed}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setWatched(true)}
          />
        </div>
      ) : (
        <video controls src={effectiveSrc} onPlay={() => setWatched(true)}>
          <track kind="captions" />
        </video>
      )}
      <figcaption>{title}</figcaption>
    </figure>
  );
}
