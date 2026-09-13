import { chapterUnits, type Heading, type Unit } from '../markdown/headings';

/**
 * Every unit the file carries, before any book rule is applied.
 *
 * Deliberately **separate from {@link allowedUnits}**, because the two cost
 * wildly different amounts and change at wildly different rates. This one
 * parses the whole file and changes only when the file does; the gate changes
 * on every choice a reader makes. Memoised together, a gamebook re-parsed its
 * entire book on every turn of the page — invisible in a linear book, whose
 * chapter changes at the same moment the work is redone, and acute in a
 * gamebook, where the whole book is one file.
 *
 * A book with no `unitDepth` has no units — the file is the page, as it always
 * was.
 */
export function unitsOf(markdown: string, depth: number | undefined): Unit[] {
  if (!depth) return [];
  return chapterUnits(markdown, depth).units;
}

/**
 * The units of a chapter this reader may open, in the order to show them.
 *
 * The gate (SPEC002 R1.1a) is asked **once**, here, and its answer serves both
 * the page and the contents rail. Asking twice would let the rail refuse a unit
 * the page then delivered, which is the failure the gate exists to prevent.
 *
 * Takes units rather than Markdown so that re-asking the gate cannot re-parse
 * the book: the cost is now unreachable from here rather than merely avoided.
 *
 * Open by default: a book that declares no rule gets all of its units.
 */
export function allowedUnits(units: Unit[], gate?: (units: Unit[]) => Unit[]): Unit[] {
  return gate ? gate(units) : units;
}

/**
 * What the contents rail lists.
 *
 * A book whose files carry units lists its **units**; every other book lists
 * the headings of the page it is showing. For a gamebook the two differ
 * completely — the rail is the reader's own journey, one entry long at the
 * start (SPEC011 §4.1) — so listing the file's headings would name every
 * section in it, which is the thing the whole model exists to prevent.
 */
export function railEntries(units: Unit[], headings: Heading[], depth: number): Heading[] {
  if (units.length === 0) return headings;
  return units.map((unit) => ({ depth, text: unit.title, id: unit.id }));
}
