import type { Chapter } from '../types';
import type { SmartbookPart } from '../package/spec';

/**
 * A run of the chapter list, either loose or under a part heading.
 *
 * The reader's navigation is one level deep and the chapter sequence stays
 * flat, so this is a *grouping of a list*, not a tree. That matters beyond
 * tidiness: prev/next, resume, search and export all address chapters by their
 * position in the flat order, and none of them should have to know that a book
 * has parts at all.
 */
export interface NavSection {
  /** The part's id, or `undefined` for chapters that belong to no part. */
  id?: string;
  /** The part's title; absent for the loose run, which is drawn without a heading. */
  title?: string;
  chapters: Chapter[];
}

/**
 * Group an ordered chapter list under the parts a book declares.
 *
 * Three rules, each of which exists because the alternative fails quietly:
 *
 * - **Order comes from the chapters, not from `parts`.** A part appears where
 *   its first chapter appears. Declaring parts in one order and chapters in
 *   another is an authoring mistake the linter reports; here the reading order
 *   wins, because that is the one the author can see in the book.
 * - **A part with no chapters is not drawn.** An empty heading in a navigation
 *   list is a dead end.
 * - **An unknown part id is treated as no part.** The runtime is forgiving by
 *   design — a typo must not cost the reader a chapter — and `part-unknown`
 *   reports it to the author instead.
 *
 * A book with no parts yields exactly one untitled section, so the caller has a
 * single code path rather than a special case.
 */
export function navSections(chapters: Chapter[], parts: SmartbookPart[] = []): NavSection[] {
  const known = new Map(parts.map((part) => [part.id, part.title]));
  const sections: NavSection[] = [];

  for (const chapter of chapters) {
    const id = chapter.part && known.has(chapter.part) ? chapter.part : undefined;
    const last = sections[sections.length - 1];

    // A part is one run: chapters that return to a part they already left start
    // a second section under the same heading rather than jumping backwards.
    if (last && last.id === id) {
      last.chapters.push(chapter);
      continue;
    }

    sections.push({ id, title: id ? known.get(id) : undefined, chapters: [chapter] });
  }

  return sections;
}
