import { createContext, useContext } from 'react';
import { createSequence } from '@smart-ebooks/engine';
import type { MusicNote } from './notes';

/**
 * The music pack's coordination context (SPEC017 QN1, SPEC001 P2.10b).
 *
 * `:::music-piece` publishes the notes and which one is on show; `:note` in the
 * prose consumes them. The shape is the chess pack's, deliberately and to the
 * letter, because that is the experiment: `createSequence` was written against
 * four domains and has only ever had one, so a second consumer is the evidence
 * that it is general rather than chess-shaped.
 *
 * Two contexts, for the same reason chess has two. The *position* is the
 * engine's shared primitive. The *piece* is ours, because nothing outside music
 * has any use for a list of pitches.
 */
export const { SequenceProvider, useSequence } = createSequence('MusicPiece');

export interface MusicPiece {
  /** Resolved once by the container, so a mark in the prose need not re-parse. */
  notes: readonly MusicNote[];
}

const PieceContext = createContext<MusicPiece | undefined>(undefined);

export const PieceProvider = PieceContext.Provider;

/** The piece a mark is inside, or `undefined` if it stands alone in the prose. */
export function usePiece(): MusicPiece | undefined {
  return useContext(PieceContext);
}
