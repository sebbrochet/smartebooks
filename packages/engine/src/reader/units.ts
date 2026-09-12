import { chapterUnits, type Heading, type Unit } from '../markdown/headings';

/**
 * The units of a chapter this reader may open, in the order to show them.
 *
 * The gate (SPEC002 R1.1a) is asked **once**, here, and its answer serves both
 * the page and the contents rail. Asking twice would let the rail refuse a unit
 * the page then delivered, which is the failure the gate exists to prevent.
 *
 * Open by default: a book that declares no rule gets all of its units, and a
 * book with no `unitDepth` has none — the file is the page, as it always was.
 */
export function allowedUnits(
  markdown: string,
  depth: number | undefined,
  gate?: (units: Unit[]) => Unit[],
): Unit[] {
  if (!depth) return [];

  const all = chapterUnits(markdown, depth).units;
  return gate ? gate(all) : all;
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
