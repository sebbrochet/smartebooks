import { useCallback, useEffect, useRef, useState } from 'react';
import { loadState, saveState } from './store';
import { useBook } from '../reader/BookContext';

/**
 * React state that transparently loads from and persists to the local store,
 * namespaced by the current book (from BookContext). Returns
 * `[value, update, loaded]`; `loaded` is false until the initial async read
 * resolves, so islands can avoid flicker or premature writes.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const { slug } = useBook();
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    loadState<T>(slug, key, initialRef.current).then((stored) => {
      if (!active) return;
      setValue(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
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
