/** A heading's id and its current distance from the top of the viewport. */
export interface HeadingOffset {
  id: string;
  top: number;
}

/**
 * Which section the reader is currently in.
 *
 * "Currently in" is the **last heading that has crossed a line near the top of
 * the viewport** — not the first heading visible. A heading sitting at the
 * bottom of the screen belongs to a section the reader has not reached yet, and
 * marking it active makes the rail run ahead of the text.
 *
 * Two cases the naive rule gets wrong, both handled here:
 *
 * - **Before the first heading.** A chapter opens with prose under its title,
 *   so nothing has crossed the line yet and the answer is *no section*, not
 *   "the first one".
 * - **At the bottom of the page.** The last section is often shorter than a
 *   screen, so its heading can never reach the line however far the reader
 *   scrolls. Without `atBottom` the final entry is unreachable — and it is the
 *   one most likely to be a summary the reader is looking for.
 */
export function activeHeading(
  offsets: HeadingOffset[],
  threshold: number,
  atBottom = false,
): string | undefined {
  if (offsets.length === 0) return undefined;
  if (atBottom) return offsets[offsets.length - 1].id;

  let current: string | undefined;
  for (const offset of offsets) {
    if (offset.top > threshold) break;
    current = offset.id;
  }
  return current;
}
