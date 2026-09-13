import { useCallback, useEffect, useState } from 'react';
import { loadState, saveState, subscribeToStore, useBook } from '@smart-ebooks/engine';
import { begin, go, type Playthrough } from './journey';

/**
 * **One record per playthrough** (SPEC011 K2.1), not one key per stat.
 *
 * Inherited from SPEC008 C17/G6.2: many small keys make `exportProgress`'s scan
 * proportional to play, and a per-key scheme invites a key the backup pattern
 * silently rejects. One record also makes a write **atomic**, which matters
 * when a section changes three stats at once.
 */
export const PLAY_KEY = 'play:current';

/**
 * The playthrough, and a commit that resolves when it is stored.
 *
 * Read through the store directly rather than `usePersistentState`, because
 * this record has **two** readers and only one of them is an island: the
 * shell's gate sits outside `BookProvider` and cannot use that hook. One
 * implementation for both keeps them from disagreeing about the key or the
 * shape.
 *
 * The commit's promise is the point. A choice must be recorded *before* the
 * route changes, or the gate is asked about a section the journey does not yet
 * contain and refuses the reader's own choice.
 */
export function usePlaythroughOf(bookSlug: string) {
  const [play, setPlay] = useState<Playthrough | null>(null);

  useEffect(() => {
    if (!bookSlug) return;

    let active = true;
    const read = () => {
      void loadState<Playthrough | null>(bookSlug, PLAY_KEY, null).then((stored) => {
        if (active) setPlay(stored);
      });
    };

    read();
    const unsubscribe = subscribeToStore(read);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bookSlug]);

  const commit = useCallback(
    (next: Playthrough) => {
      setPlay(next);
      return saveState(bookSlug, PLAY_KEY, next);
    },
    [bookSlug],
  );

  return [play, commit] as const;
}

/** The same record, for an island, which knows its book from context. */
export function usePlaythrough() {
  return usePlaythroughOf(useBook().slug);
}

/**
 * Taking a choice out of `from`, towards `to`.
 *
 * A playthrough that has not started begins where the reader is standing: the
 * book's first unit is the only one the gate allows, so that is necessarily
 * section one, and nothing needs to declare it twice.
 */
export function take(play: Playthrough | null, from: string, to: string): Playthrough {
  return go(play ?? begin(from), to);
}
