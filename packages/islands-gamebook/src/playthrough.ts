import { useCallback, useEffect, useState } from 'react';
import { loadState, saveState, subscribeToStore, useBook, type Unit } from '@smart-ebooks/engine';
import { begin, go, readableSections, type Playthrough } from './journey';

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

/**
 * The reading gate (SPEC002 R1.1a) as this domain answers it: a reader may open
 * what they have been to, in the order they went.
 *
 * Before the first choice there is no journey, so only the book's opening unit
 * is allowed — which is SPEC011 §4 rule 1, and the reason a gamebook's contents
 * list starts one entry long and is *earned* rather than hidden (§4.1).
 *
 * **De-duplicated, unlike the journey itself.** Visiting 42 twice is genuinely
 * two visits (§4.2a) and the record keeps both, but a contents list naming the
 * same room twice is furniture rather than history — and two entries with one
 * id is also two React keys with one value.
 */
export function journeyGate(play: Playthrough | null) {
  return (units: Unit[]): Unit[] => {
    if (!play) return units.slice(0, 1);

    return readableSections(play)
      .map((section) => units.find((unit) => unit.id === section))
      .filter((unit): unit is Unit => unit !== undefined);
  };
}
