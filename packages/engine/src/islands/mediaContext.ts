import { createContext, useContext } from 'react';
import { createSequence } from './sequence';
import type { TimeMark } from './timedMedia';

/**
 * The timed-media pack's coordination context (SPEC012 §4.1).
 *
 * Two contexts, deliberately, and for the reason the chess pack gives: the
 * *position* is the engine's shared sequence primitive, because chess plies and
 * media timestamps are claimed to be the same shape — this island exists to
 * find out whether that is true (SPEC012 §1.1) — while the *marks* are specific
 * to this island and ride alongside.
 *
 * **`createSequence` is used unmodified on purpose.** SPEC012 decision 3: if it
 * turns out to need changing, that is the finding and it gets written down,
 * not patched around.
 */
export const { SequenceProvider, useSequence } = createSequence('MediaLesson');

export interface MediaLesson {
  /** The author's marks, in time order. */
  marks: readonly TimeMark[];
  /** Whether a player is actually present to be driven. */
  ready: boolean;
}

const MediaContext = createContext<MediaLesson | undefined>(undefined);

export const MediaProvider = MediaContext.Provider;

/** The lesson a child island is inside, or `undefined` if it stands alone. */
export function useMediaLesson(): MediaLesson | undefined {
  return useContext(MediaContext);
}
