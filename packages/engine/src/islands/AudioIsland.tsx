import type { IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { useBook } from '../reader/BookContext';
import { useOnline } from '../reader/useOnline';
import { isHttpsUrl } from './mediaUrl';
import { attrText } from './attributes';

/**
 * Embedded audio island. Renders a native audio element and records a local
 * "played" flag when playback starts.
 */
export function AudioIsland({ id, attributes, packagedAssets }: IslandComponentProps) {
  const { trusted } = useBook();
  const online = useOnline();
  const src = attrText(attributes.src);
  const title = attrText(attributes.title, 'Audio');
  const fromPackage = packagedAssets.includes('src');
  const [played, setPlayed] = usePersistentState<boolean>(`media:${id}`, false);

  if (!src) {
    return (
      <div className="island island--audio island--unknown" role="note">
        Audio is missing a <code>src</code>.
      </div>
    );
  }

  if (!trusted && !fromPackage && !isHttpsUrl(src)) {
    return (
      <div className="island island--audio island--disabled" role="note">
        Audio source blocked in an imported book.
      </div>
    );
  }

  return (
    <figure className={`island island--audio ${played ? 'is-played' : ''}`}>
      <figcaption>{title}</figcaption>
      <audio controls src={src} onPlay={() => setPlayed(true)} />
      {/* Packaged audio is inside the book and plays with no network; anything
          else is fetched on demand and offline simply does nothing. See
          `useOnline` for why this warns rather than disables. */}
      {!fromPackage && !online && (
        <p className="island__offline" role="note">
          This audio is not part of the book and needs a connection to play.
        </p>
      )}
    </figure>
  );
}
