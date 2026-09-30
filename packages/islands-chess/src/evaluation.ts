/**
 * Presenting a stored `[%eval]`.
 *
 * The value on a {@link GameNode} is **White-relative** and kept as the
 * annotator wrote it, so these are the only functions that decide how it looks.
 * Keeping them pure and here means the move list, the board and — later — the
 * evaluation bar cannot disagree about what `-1.3` means.
 */

/**
 * `0.54` → `+0.54`, `-1.3` → `-1.3`, `#5` → `#5`.
 *
 * The author's precision is preserved rather than rounded: a book that wrote
 * two decimals meant two. Only the sign is added, because a bare `0.54` reads
 * as a quantity rather than as an advantage.
 */
export function formatEvaluation(value: string): string {
  if (value.startsWith('#') || value.startsWith('-')) return value;
  return `+${value}`;
}

/** Whether a stored evaluation favours White, for a label a screen reader reads. */
export function describeEvaluation(value: string): string {
  if (value.startsWith('#')) {
    return value.startsWith('#-') ? 'Black mates' : 'White mates';
  }
  const pawns = Number(value);
  if (!Number.isFinite(pawns) || pawns === 0) return 'Level';
  return pawns > 0 ? 'White is better' : 'Black is better';
}

/**
 * How much of an evaluation bar belongs to White, as a percentage.
 *
 * A **sigmoid**, not a linear scale: the difference between +0.2 and +0.6 is
 * most of what a reader can act on, while everything past about +5 is the same
 * news. A linear mapping spends most of its travel on distinctions nobody needs
 * and crushes the ones they do.
 *
 * Clamped to 1–99 so a winning side is never a blank bar, and a forced mate
 * pins to the end by sign. The shape is taken from an existing implementation
 * rather than invented.
 */
export function evaluationPercent(value: string): number {
  if (value.startsWith('#')) return value.startsWith('#-') ? 0 : 100;

  const pawns = Number(value);
  if (!Number.isFinite(pawns)) return 50;

  const scaled = 50 + 50 * (2 / (1 + Math.exp(-0.5 * pawns)) - 1);
  return Math.max(1, Math.min(99, scaled));
}
