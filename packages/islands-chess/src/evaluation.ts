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
