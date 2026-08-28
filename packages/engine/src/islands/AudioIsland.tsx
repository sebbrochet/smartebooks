import type { IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { useBook } from '../reader/BookContext';
import { isHttpsUrl } from './mediaUrl';
import { attrText } from './attributes';

/**
 * Embedded audio island. Renders a native audio element and records a local
 * "played" flag when playback starts.
 */
export function AudioIsland({ id, attributes }: IslandComponentProps) {
  const { trusted, resolveAsset } = useBook();
  const src = attrText(attributes.src);
  const title = attrText(attributes.title, 'Audio');
  const resolvedAsset = src.startsWith('assets/') ? resolveAsset?.(src) : undefined;
  const effectiveSrc = resolvedAsset ?? src;
  const [played, setPlayed] = usePersistentState<boolean>(`media:${id}`, false);

  if (!src) {
    return (
      <div className="island island--audio island--unknown" role="note">
        Audio is missing a <code>src</code>.
      </div>
    );
  }

  if (!trusted && !resolvedAsset && !isHttpsUrl(src)) {
    return (
      <div className="island island--audio island--disabled" role="note">
        Audio source blocked in an imported book.
      </div>
    );
  }

  return (
    <figure className={`island island--audio ${played ? 'is-played' : ''}`}>
      <figcaption>{title}</figcaption>
      <audio controls src={effectiveSrc} onPlay={() => setPlayed(true)} />
    </figure>
  );
}
