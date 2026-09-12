/**
 * Times, marks, and the one interesting question in timed media: given a clock
 * that moves continuously, which of the author's marks is the reader on?
 *
 * Pure and DOM-free, because it is the part worth testing exhaustively and the
 * part a linter will eventually need (SPEC012 V1.5).
 *
 * **The formats are borrowed rather than invented.** `M:SS`, `H:MM:SS` and bare
 * seconds are what PGN's `[%ts …]` comment token already uses in the owner's
 * chess-video player, and that token lives in the same comment slot this repo's
 * chess pack already parses for `[%cal]` / `[%csl]`. Accepting the same
 * spellings now is what lets a video drive a *game* later without a migration
 * (SPEC012 §2.1, QV4).
 */

export interface TimeMark {
  /**
   * Whole seconds from the start, and the mark's **identity** — the string form
   * of this is the sequence position (SPEC001 P2.10b).
   *
   * Whole seconds because a mark is a moment an author chose, not a sample: two
   * marks a fifth of a second apart are a mistake, not a distinction.
   */
  at: number;
  /** What the author called this moment. Never empty — falls back to the time. */
  label: string;
}

/**
 * Seconds from `SS`, `M:SS`, `MM:SS` or `H:MM:SS`, or `undefined`.
 *
 * Strict about the shape on purpose: everything after the first group must be
 * exactly two digits and under sixty, so `1:75` and `1:5` are refused rather
 * than quietly read as 135 and 65. The runtime is forgiving with the *result*
 * — an unparseable mark stays the plain text the author wrote — and the linter
 * is where it is reported (SPEC001 P1.2).
 */
export function parseTime(value: string): number | undefined {
  const text = value.trim();
  // Linear, not exponential: the repetition after `\d+` is bounded at two.
  // eslint-disable-next-line security/detect-unsafe-regex
  if (!/^\d+(?::\d{2}){0,2}$/.test(text)) return undefined;

  const parts = text.split(':').map(Number);
  // The first group is unbounded — `90:00` is a legitimate ninety minutes — but
  // the rest are clock fields.
  if (parts.slice(1).some((part) => part > 59)) return undefined;

  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** `84` → `1:24`; `3723` → `1:02:03`. The inverse of {@link parseTime}. */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(whole % 60)}`
    : `${minutes}:${pad(whole % 60)}`;
}

/**
 * The author's marks, from the container's fenced block: a time, then a label.
 *
 * ```text
 * 0:00  Where it begins
 * 1:24  The bishop commits
 * ```
 *
 * **Declared rather than gathered from the prose**, which mirrors a
 * `:::chess-game` owning its PGN. The container cannot see inside its children,
 * so marks scattered as `:at[…]` would leave it with no list to step through and
 * `::media-marks` with no labels to print. It also gives the static form
 * something real to be: the index is the artefact this whole island degrades
 * into (SPEC001 P1.1).
 *
 * Sorted by time, and duplicates collapse — two labels for one moment would
 * make `positions` ambiguous, and the first is the one the author wrote first.
 */
export function parseMarks(body: string): TimeMark[] {
  const marks = new Map<number, TimeMark>();

  for (const line of body.split('\n')) {
    const text = line.trim();
    if (!text) continue;

    const [, time = '', label = ''] = /^(\S+)\s*(.*)$/.exec(text) ?? [];
    const at = parseTime(time);
    if (at === undefined || marks.has(at)) continue;

    marks.set(at, { at, label: label.trim() || formatTime(at) });
  }

  return [...marks.values()].sort((a, b) => a.at - b.at);
}

/**
 * The mark the clock is in: the last one at or before `seconds`.
 *
 * **No tolerance and no hysteresis**, deliberately. The obvious worry is
 * flickering at a boundary, and the answer is that nothing samples the clock
 * finely enough for it to matter — a `timeupdate` fires about four times a
 * second. The prior art made the same call for the same reason and has not
 * regretted it (SPEC012 §2.4). A tolerance would also be a lie at a boundary
 * the author deliberately placed.
 *
 * `undefined` before the first mark, which is a real place: it is the sequence's
 * `''` position, the analogue of a chess game before its first move.
 */
export function markAt(marks: readonly TimeMark[], seconds: number): TimeMark | undefined {
  let found: TimeMark | undefined;

  for (const mark of marks) {
    if (mark.at > seconds) break;
    found = mark;
  }

  return found;
}

/** The sequence position for a mark, and for the place before the first one. */
export function positionOf(mark: TimeMark | undefined): string {
  return mark ? String(mark.at) : '';
}
