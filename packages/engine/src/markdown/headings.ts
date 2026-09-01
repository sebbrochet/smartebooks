import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root, Heading as MdastHeading, Parent } from 'mdast';
import { mdastToText } from './extract';

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
 * The route that opens a chapter at one of its sections.
 *
 * A **query parameter, not a fragment**: the app's route already lives in the
 * hash, so `#section` would replace it and send the reader out of the chapter
 * rather than down it. One helper because two callers need to agree — the
 * contents rail and the anchor beside each heading.
 */
export function headingHref(basePath: string, chapterSlug: string, id: string): string {
  return `#${basePath}/${chapterSlug}?h=${encodeURIComponent(id)}`;
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
  const slug = uniqueSlugger();
  const headings: Heading[] = [];

  visit(parser.parse(markdown) as Root, 'heading', (node: MdastHeading, _index, parent) => {
    if (node.depth < 2 || node.depth > maxDepth) return;
    if (isDirective(parent)) return;

    const text = mdastToText(node).trim();
    if (!text) return;

    headings.push({ depth: node.depth, text, id: slug(text) });
  });

  return headings;
}

function isDirective(parent: Parent | undefined): boolean {
  const type = (parent as { type?: string } | undefined)?.type;
  return type === 'containerDirective' || type === 'leafDirective' || type === 'textDirective';
}
