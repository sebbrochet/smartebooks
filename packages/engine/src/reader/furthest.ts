import type { Chapter } from '../types';

/**
 * The furthest chapter reached, which never moves backwards.
 *
 * Distinct from "where the reader is": flipping back to re-read chapter 2
 * changes the current chapter and must not change how far they have got. A
 * progressive glossary that reveals terms as the book unfolds would otherwise
 * re-hide them the moment someone looked something up (SPEC002 S5, SPEC001
 * P2.7).
 *
 * Compared by **position in the book's own chapter list**, not by slug or by
 * date: order is the only thing that makes "further" mean anything, and only
 * the book knows its order.
 *
 * A remembered chapter that no longer exists — the book was re-edited between
 * visits — is treated as no mark at all rather than as infinitely far. The
 * reader loses a little history; the alternative is a high-water mark stuck
 * beyond the end of the book forever.
 */
export function furthestOf(
  chapters: Chapter[],
  previous: string | undefined,
  current: string,
): string {
  const index = (slug: string | undefined) =>
    slug === undefined ? -1 : chapters.findIndex((chapter) => chapter.slug === slug);

  return index(previous) > index(current) ? (previous as string) : current;
}
