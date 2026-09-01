import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import type { VFile } from 'vfile';
import { uniqueSlugger } from './headings';
import { mdastToText } from './extract';

/**
 * Gives every section heading an `id`, and a link to itself.
 *
 * Two things depend on it. A reader can send someone *this section* rather than
 * *this chapter* — SPEC002 S3 records that nothing below a chapter was
 * addressable — and the table of contents has somewhere to point.
 *
 * Ids come from {@link uniqueSlugger}, the same function `chapterHeadings`
 * uses, because a contents entry whose fragment does not match the heading it
 * names is a link that scrolls nowhere.
 *
 * `h1` is skipped: a chapter has one, it is the title, and there is nothing to
 * navigate to within it.
 *
 * **The anchor's href is built by the caller**, through `file.data.headingLink`.
 * The app is hash-routed, so the obvious `href="#section"` would replace the
 * route and navigate the reader out of the chapter they are reading. Without a
 * builder the heading still gets its id and no anchor is added — a missing
 * affordance beats a link that silently does the wrong thing.
 */
export function rehypeHeadingIds() {
  return (tree: Root, file: VFile) => {
    const slug = uniqueSlugger();
    const link = (file.data as { headingLink?: (id: string) => string }).headingLink;

    visit(tree, 'element', (node: Element) => {
      if (!/^h[2-6]$/.test(node.tagName)) return;

      const properties = (node.properties ??= {});
      // An id the author set by other means wins: it is a promise someone may
      // already be linking to.
      if (typeof properties.id === 'string' && properties.id) return;

      const text = mdastToText(node).trim();
      if (!text) return;

      const id = slug(text);
      properties.id = id;
      if (!link) return;

      // The anchor is last so it reads after the heading text, and is
      // `aria-hidden` because a screen reader announcing "permalink" on every
      // heading is noise — the heading itself is already the landmark.
      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: {
          href: link(id),
          className: ['heading-anchor'],
          ariaHidden: 'true',
          tabIndex: -1,
        },
        children: [{ type: 'text', value: '#' }],
      });
    });
  };
}
