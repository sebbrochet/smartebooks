import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

interface DirectiveLike {
  type: string;
  attributes?: Record<string, unknown> | null;
}

/**
 * Every island id an author wrote in a chapter.
 *
 * Unlike `chapterScorables`, this asks nothing about *which* island: an id is
 * an id, and what reads it back is the store, which does not care either. The
 * registry is not consulted for the same reason — a book may use a pack this
 * reader does not have, and its ids are still the author's and still addressed
 * by keys in the store.
 */
export function islandIds(markdown: string): string[] {
  const ids = new Set<string>();

  visit(parser.parse(markdown) as Root, (node) => {
    const directive = node as unknown as DirectiveLike;
    if (
      directive.type !== 'containerDirective' &&
      directive.type !== 'leafDirective' &&
      directive.type !== 'textDirective'
    ) {
      return;
    }

    const id = directive.attributes?.id;
    if (typeof id === 'string' && id !== '') ids.add(id);
  });

  return [...ids];
}

/** Every island id in a whole book's content, keyed by zip path or otherwise. */
export function bookIslandIds(content: Record<string, string>): Set<string> {
  const ids = new Set<string>();
  for (const markdown of Object.values(content)) {
    for (const id of islandIds(markdown)) ids.add(id);
  }
  return ids;
}
