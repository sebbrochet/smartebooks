import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * The one coordination primitive the engine ships (SPEC001 P2.10b).
 *
 * Four unrelated domains asked for the same thing — **an ordered sequence of
 * positions, a current one, and a synchronised view**: chess plies driving a
 * board, music timestamps driving a score cursor, comic panels driving a
 * viewport, recipe servings driving the quantities in a sentence. The spec's
 * instruction was to build it once rather than four times, so this is it.
 *
 * The engine mediates nothing beyond this. A pack calls {@link createSequence}
 * to get a context **it owns**, provides it from its container island, and its
 * own child islands consume it. Nothing here knows what a position *is* — for
 * chess it is a path through a move tree, for a comic a panel id.
 *
 * The context is **bidirectional**, which the cookbook domain test insisted on
 * before it was built: chess `:move` *writes* the position on click, while
 * `:qty` only *reads* the published value. Both are `useSequence()`.
 */
export interface SequenceValue {
  /**
   * The positions of the line the reader is currently on, in order.
   *
   * Not necessarily every position in the work: a chess game with sidelines has
   * no single order, so its container publishes the line being read and
   * recomputes it when the reader steps into a branch. That keeps {@link step}
   * meaning "the next move in *this* line" rather than silently jumping out of
   * a variation.
   */
  positions: readonly string[];
  /** The position on show. `''` means *before the first* — a real place. */
  current: string;
  /** Index of `current` in `positions`; `-1` at the start. */
  index: number;
  /** Show a position. Any position the container understands, not just one in `positions`. */
  go: (position: string) => void;
  /** Move along `positions`, clamped at both ends. `''` is the low bound. */
  step: (delta: number) => void;
}

export interface SequenceProviderProps {
  positions: readonly string[];
  current: string;
  onGo: (position: string) => void;
  children: ReactNode;
}

/**
 * Builds a sequence context for one pack.
 *
 * Deliberately **controlled**: the container owns the position, because it is
 * the thing that persists it, migrates it and clamps it to a game that may have
 * changed since the reader last opened the book.
 */
export function createSequence(displayName: string) {
  const Context = createContext<SequenceValue | undefined>(undefined);
  Context.displayName = displayName;

  function SequenceProvider({ positions, current, onGo, children }: SequenceProviderProps) {
    const value = useMemo<SequenceValue>(() => {
      const index = positions.indexOf(current);
      return {
        positions,
        current,
        index,
        go: onGo,
        step: (delta: number) => {
          // `-1` is the start, so the usable range is [-1, length - 1] and both
          // ends clamp: stepping back from the first move lands on the start,
          // and stepping past the last stays there.
          const target = Math.max(-1, Math.min(index + delta, positions.length - 1));
          onGo(target < 0 ? '' : positions[target]);
        },
      };
    }, [positions, current, onGo]);

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  /** The sequence a child island is inside, or `undefined` if it is not in one. */
  function useSequence(): SequenceValue | undefined {
    return useContext(Context);
  }

  return { SequenceProvider, useSequence };
}
