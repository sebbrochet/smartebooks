import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Book } from '../types';
import type { IslandDefinition } from '../islandRegistry';
import type { SmartbookDescriptor } from './spec';

/**
 * SPEC001 P2.1 — a package states which islands its content needs.
 *
 * Without this, a reader missing an island pack discovers the problem one grey
 * "unknown block" at a time, scattered through the book, with no hint of what
 * is missing or why. The declaration lets the reader say so once, up front.
 */

/** Directive names used in a Markdown source, in order of first appearance. */
export function collectDirectiveNames(markdown: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(markdown);
  const names: string[] = [];

  visit(tree as Root, (node) => {
    const n = node as unknown as { type: string; name?: string };
    if (
      n.type !== 'containerDirective' &&
      n.type !== 'leafDirective' &&
      n.type !== 'textDirective'
    ) {
      return;
    }
    if (n.name && !names.includes(n.name)) names.push(n.name);
  });

  return names;
}

/**
 * The islands a book's content actually uses, by canonical name.
 *
 * Anything already declared is kept even if unused: a book re-exported by a
 * reader that lacks the chess pack must not quietly lose its chess
 * requirement just because this reader could not recognise those directives.
 */
export function deriveRequiredIslands(book: Book): string[] {
  const canonical = new Map<string, string>();
  for (const island of book.islands) {
    canonical.set(island.name, island.name);
    for (const alias of island.aliases ?? []) canonical.set(alias, island.name);
  }

  const required = new Set(book.descriptor.islands?.required ?? []);
  for (const chapter of book.chapters) {
    for (const name of collectDirectiveNames(chapter.markdown)) {
      const resolved = canonical.get(name);
      // Unrecognised directives are not necessarily islands (they may be
      // formatting extensions), so only known ones become requirements.
      if (resolved) required.add(resolved);
    }
  }

  return [...required].sort();
}

/**
 * Islands the book declares that this reader cannot provide. Names are compared
 * canonically, so a book declaring an old alias is not reported as missing.
 */
export function missingIslands(
  descriptor: Pick<SmartbookDescriptor, 'islands'>,
  islands: IslandDefinition[],
): string[] {
  const required = descriptor.islands?.required;
  if (!required?.length) return [];

  const available = new Set<string>();
  for (const island of islands) {
    available.add(island.name);
    for (const alias of island.aliases ?? []) available.add(alias);
  }

  return required.filter((name) => !available.has(name)).sort();
}
