import { useCallback, useEffect, useRef, useState } from 'react';
import { loadState, saveState, subscribeToStore } from './store';
import { useBook } from '../reader/BookContext';

/** Cheap structural comparison, so an unrelated write cannot force a re-render. */
function same<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * React state that transparently loads from and persists to the local store,
 * namespaced by the current book (from BookContext). Returns
 * `[value, update, loaded]`; `loaded` is false until the initial async read
 * resolves, so islands can avoid flicker or premature writes.
 *
 * The hook also **follows the store**: any island writing the same key updates
 * every reader of it. Without that, two islands sharing a key silently disagree
 * until a reload — a dice roll would not reach the character sheet beside it
 * (SPEC001 L13).
 */
export function usePersistentState<T>(key: string, initial: T) {
  const { slug } = useBook();
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    let active = true;
    setLoaded(false);

    const read = () => {
      void loadState<T>(slug, key, initialRef.current).then((stored) => {
        if (!active) return;
        // Compare before setting: `notify` fires for every key in the book, and
        // this hook's own writes come back through it too.
        setValue((current) => (same(current, stored) ? current : stored));
        setLoaded(true);
      });
    };

    read();
    const unsubscribe = subscribeToStore(read);

    return () => {
      // Both matter: stop listening, and ignore any read still in flight.
      active = false;
      unsubscribe();
    };
  }, [slug, key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      void saveState(slug, key, next);
    },
    [slug, key],
  );

  return [value, update, loaded] as const;
}
