import type { Chapter } from '../types';
import type { Unit } from '../markdown/headings';
import { unitsOf } from './units';

/**
 * Every unit the book carries, and which file each was written in.
 *
 * A gamebook numbers its sections 1..n across the whole book and the reader is
 * told « rendez-vous au 217 » — which file 217 lives in is the author's filing
 * decision and must never reach the prose, the directive, or the link. So the
 * book, not the chapter, is the unit of address, and this is the index that
 * makes that possible.
 *
 * **One walk of the book, memoised against the book**, rather than one walk of
 * a chapter memoised against the chapter. For a book split into seven acts
 * that is the same total parsing as the single file it replaces, done once
 * instead of once per act the reader crosses.
 *
 * A book with no `unitDepth` has no units and is not walked at all: the file
 * is the page, as it always was.
 */
export interface BookUnits {
  /** Every unit, in chapter order and then in the order each file wrote them. */
  all: Unit[];
  /** The file a unit id was written in. */
  chapterOf: Map<string, Chapter>;
}

export function bookUnits(chapters: Chapter[], depth: number | undefined): BookUnits {
  const all: Unit[] = [];
  const chapterOf = new Map<string, Chapter>();

  for (const chapter of chapters) {
    for (const unit of unitsOf(chapter.markdown, depth)) {
      // First writer wins. Ids are slugged per file, so nothing stops two files
      // opening a `## 1`; the linter is what refuses it (K4.2), because a
      // reader mid-journey is owed a page rather than an error.
      if (chapterOf.has(unit.id)) continue;

      all.push(unit);
      chapterOf.set(unit.id, chapter);
    }
  }

  return { all, chapterOf };
}
