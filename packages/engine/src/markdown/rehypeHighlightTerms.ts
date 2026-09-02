import type { Root, Element, RootContent, Text } from 'hast';
import type { VFile } from 'vfile';
import { highlight } from '../reader/search';

/**
 * Marks a search's terms in the chapter it sent the reader to.
 *
 * Landing on a section is only half of "I found it": the section is a screen of
 * prose, and the word is somewhere in it. Marking the terms is what turns the
 * arrival into an answer (SPEC002 N14).
 *
 * The terms travel per render on the file rather than in the processor, because
 * the processor is cached per book and one chapter's query must not leak into
 * the next chapter's render.
 */

/**
 * Subtrees left alone.
 *
 * `island` and `island-inline` are the engine's own elements: the first carries
 * its configuration in an attribute and has no prose to mark, and the second's
 * children are a label a component reads. Injecting elements into either means
 * handing an island something other than the text it was given.
 *
 * `code` and `pre` are excluded because a highlight inside a code sample is
 * indistinguishable from syntax, and a search for "if" would stripe the page.
 */
const LEAVE_ALONE = new Set(['island', 'island-inline', 'code', 'pre', 'mark']);

export function rehypeHighlightTerms() {
  return (tree: Root, file: VFile) => {
    const terms = file.data.highlightTerms as string[] | undefined;
    if (!terms?.length) return;

    // A hand-written walk rather than `visit`, because the decision is about
    // *ancestors* — whether anything above this text was a thing to leave
    // alone — and a visitor only offers the immediate parent.
    markChildren(tree, terms);
  };
}

function markChildren(parent: Root | Element, terms: string[]): void {
  const next: RootContent[] = [];
  let changed = false;

  for (const child of parent.children) {
    if (child.type === 'element') {
      if (!LEAVE_ALONE.has(child.tagName)) markChildren(child, terms);
      next.push(child);
      continue;
    }

    if (child.type !== 'text') {
      next.push(child);
      continue;
    }

    const parts = highlight(child.value, terms);
    if (parts.length === 1 && !parts[0].match) {
      next.push(child);
      continue;
    }

    changed = true;
    for (const part of parts) {
      const text: Text = { type: 'text', value: part.text };
      if (!part.match) {
        next.push(text);
        continue;
      }
      next.push({
        type: 'element',
        tagName: 'mark',
        properties: { className: ['term-highlight'] },
        children: [text],
      });
    }
  }

  if (changed) parent.children = next;
}
