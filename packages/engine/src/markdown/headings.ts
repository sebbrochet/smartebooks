import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root, Heading as MdastHeading, Parent } from 'mdast';
import { mdastToText } from './extract';
import { toPlainText } from '../content/parse';

/**
 * Heading identity, shared by the two things that need it to agree: the
 * `id` put on a rendered heading (`rehypeHeadingIds`) and the link that points
 * at it from the table of contents (`chapterHeadings`).
 *
 * They are computed in different passes over different trees, so a test asserts
 * that every id a contents list emits exists in the rendered HTML. Two
 * independent sluggers that drift produce links that scroll nowhere — a failure
 * a reader meets and an author never does.
 */

/**
 * A heading's URL fragment: lowercase, punctuation dropped, spaces hyphenated.
 *
 * Diacritics are folded rather than stripped, so *"Créer un agent"* becomes
 * `creer-un-agent` instead of `crer-un-agent`. Books in French and Spanish are
 * the near-term case, and losing a letter per accent makes a fragment that is
 * both ugly and ambiguous.
 */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      // Combining marks left behind by the decomposition above.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/**
 * Makes a slug unique within one document by suffixing repeats, the way GitHub
 * does: `overview`, `overview-1`, `overview-2`. Two sections may legitimately
 * share a name; two ids may not.
 */
export function uniqueSlugger() {
  const seen = new Map<string, number>();

  return (text: string): string => {
    const base = slugify(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

export interface Heading {
  /** 2 for `##`, 3 for `###`. */
  depth: number;
  text: string;
  /** The fragment to link to; matches the rendered heading's `id`. */
  id: string;
}

/**
 * The route that opens a chapter, optionally at one of its sections and
 * optionally with a search's terms marked in it.
 *
 * A **query parameter, not a fragment**: the app's route already lives in the
 * hash, so `#section` would replace it and send the reader out of the chapter
 * rather than down it.
 *
 * `s` for section, `h` for highlight — the same split MkDocs Material uses,
 * which is why `h` was kept free when sections shipped (SPEC002 §3.1).
 */
export function readerHref(
  basePath: string,
  chapterSlug: string,
  options: { section?: string; terms?: string[] } = {},
): string {
  const query = new URLSearchParams();
  if (options.section) query.set('s', options.section);
  if (options.terms?.length) query.set('h', options.terms.join(' '));

  const search = query.toString();
  return `#${basePath}/${chapterSlug}${search ? `?${search}` : ''}`;
}

/**
 * A section's own link. One helper because two callers need to agree — the
 * contents rail and the anchor beside each heading.
 */
export function headingHref(basePath: string, chapterSlug: string, id: string): string {
  return readerHref(basePath, chapterSlug, { section: id });
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/**
 * The headings of one chapter, for a table of contents.
 *
 * **Headings inside a directive are skipped**, and that is the whole reason
 * this reads the parsed tree rather than scanning lines. A `:::quiz` writes its
 * questions as `###` — in the bundled books, *every* `###` is a quiz question —
 * so a contents list built from raw Markdown would advertise "What does a token
 * represent?" as a section of the chapter and link to a heading the reader
 * never sees, because the island replaces its own body.
 *
 * `h1` is excluded: it is the chapter's title, which the page already shows.
 */
export function chapterHeadings(markdown: string, maxDepth = 3): Heading[] {
  return headingMarks(markdown, (depth) => depth <= maxDepth).marks.map((mark) => mark.heading);
}

/**
 * A section of a chapter: one heading and the prose under it.
 *
 * The unit search results should point at. A chapter-level result says "the
 * word is somewhere in these nine pages"; a passage says where.
 *
 * Derived from the same walk as {@link chapterHeadings} — and that list is now
 * derived from *this* — so the two can never disagree about which headings
 * exist or what their ids are. They previously could, and only a test stopped
 * it.
 *
 * The text before the first heading is a passage with no heading: a chapter
 * usually opens with a paragraph or two under its title, and those words are
 * as findable as any others.
 */
export interface Passage {
  heading?: Heading;
  /** The prose under the heading, **not including the heading itself**. */
  text: string;
}

export function chapterPassages(markdown: string, maxDepth = 3): Passage[] {
  const { marks, titleEnd } = headingMarks(markdown, (depth) => depth <= maxDepth);

  // Sliced from the source by node offset rather than rebuilt from the tree.
  // `toPlainText` is already the forgiving stripper the rest of search uses, so
  // reusing it keeps one definition of "what counts as text" instead of two
  // that drift on the next directive we add.
  //
  // Each body starts *after* its heading, because the caller already has the
  // heading and showing it twice — as a result's title and again at the head of
  // its own snippet — wastes the line that was supposed to give context.
  const passages: Passage[] = [];
  const preamble = toPlainText(markdown.slice(titleEnd, marks[0]?.from ?? markdown.length));
  if (preamble) passages.push({ text: preamble });

  marks.forEach((mark, index) => {
    const end = marks[index + 1]?.from ?? markdown.length;
    passages.push({ heading: mark.heading, text: toPlainText(markdown.slice(mark.to, end)) });
  });

  return passages;
}

/** A heading, and where it sits in the source. */
interface Mark {
  heading: Heading;
  /** Offset of the heading itself. */
  from: number;
  /** Offset just past the heading, where its body begins. */
  to: number;
}

/**
 * One walk over the headings, for every consumer that needs them.
 *
 * **Ids are assigned to every `h2`–`h6` and the result is filtered afterwards**,
 * which is the whole reason this is one function. `uniqueSlugger` numbers
 * repeats in the order it meets them, so a walk that skips deep headings
 * *before* slugging hands out different ids from one that does not — and
 * `rehypeHeadingIds` slugs the rendered `h2`–`h6` unconditionally. A chapter
 * with `#### Overview` above `## Overview` gave the `h4` the plain id and
 * pushed the section to `overview-1`, so the contents entry linked to the wrong
 * heading. Filtering last is what keeps every consumer agreeing with the page.
 *
 * `h1` is not a candidate: it is the chapter's title. Recording where it ends
 * keeps it out of the opening passage, so a search result does not print the
 * chapter's name as its own excerpt.
 *
 * **Headings inside a directive are skipped**, which is why this reads the
 * parsed tree rather than scanning lines: in the bundled books *every* `###` is
 * a `:::quiz` question, and the island replaces its own body.
 */
function headingMarks(
  markdown: string,
  wanted: (depth: number) => boolean,
): { marks: Mark[]; titleEnd: number } {
  const slug = uniqueSlugger();
  const marks: Mark[] = [];
  let titleEnd = 0;

  visit(parser.parse(markdown) as Root, 'heading', (node: MdastHeading, _index, parent) => {
    if (isDirective(parent)) return;

    if (node.depth === 1) {
      titleEnd = Math.max(titleEnd, node.position?.end.offset ?? 0);
      return;
    }

    const text = mdastToText(node).trim();
    if (!text) return;

    const from = node.position?.start.offset;
    const to = node.position?.end.offset;
    if (from === undefined || to === undefined) return;

    marks.push({ heading: { depth: node.depth, text, id: slug(text) }, from, to });
  });

  return { marks: marks.filter((mark) => wanted(mark.heading.depth)), titleEnd };
}

/** One addressable unit of content: a heading and everything under it. */
export interface Unit {
  id: string;
  title: string;
  /** The heading **and** its body, as Markdown. */
  markdown: string;
}

export interface ChapterUnits {
  /** The chapter's title and any prose before the first unit. */
  preamble: string;
  units: Unit[];
}

/**
 * Splits one file into the units it carries (SPEC005 M2).
 *
 * A file is a container of units and neither number constrains the other: an
 * author writes twenty sections in one file because that is pleasant to edit,
 * and the reader is delivered one because that is what they asked for. Which
 * is also what makes withholding a section possible at all — a reader cannot
 * scroll from section 12 into section 13 if section 13 was never rendered
 * (SPEC011 B2).
 *
 * **Exactly one depth**, not a range: units sit at one level and a deeper
 * heading is a heading *within* a unit, not a sibling of it.
 *
 * **A unit carries its own heading**, unlike a {@link Passage}, which drops it
 * because its caller already has it. A unit is delivered alone, so it has to
 * bring its title with it.
 */
export function chapterUnits(markdown: string, depth = 2): ChapterUnits {
  const { marks } = headingMarks(markdown, (each) => each === depth);

  return {
    preamble: markdown.slice(0, marks[0]?.from ?? markdown.length).trim(),
    units: marks.map((mark, index) => ({
      id: mark.heading.id,
      title: mark.heading.text,
      markdown: markdown.slice(mark.from, marks[index + 1]?.from ?? markdown.length).trim(),
    })),
  };
}

function isDirective(parent: Parent | undefined): boolean {
  const type = (parent as { type?: string } | undefined)?.type;
  return type === 'containerDirective' || type === 'leafDirective' || type === 'textDirective';
}
