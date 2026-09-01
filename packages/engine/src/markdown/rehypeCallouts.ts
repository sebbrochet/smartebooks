import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';

/**
 * Marks the editorial charter's callouts so they can be told apart.
 *
 * The charter (§2) has defined five kinds since it was written — key concept,
 * how it works, tip, pitfall, definition — as blockquotes prefixed with an
 * emoji, deliberately: the form is greppable, reads fine as raw Markdown, and
 * needs no directive. What it never had was a *renderer*. All five arrived as
 * the same undifferentiated blockquote, so an author following the contract to
 * the letter got no more than a grey left border for their trouble.
 *
 * This reads the prefix the charter already prescribes and adds a class. It
 * deliberately does **not** rewrite the text: the emoji is the author's, it is
 * what makes the convention greppable, and it is the only marker that survives
 * into an export where no stylesheet runs.
 *
 * ### Why a plugin and not CSS
 *
 * CSS cannot select on text content — there is no `:has-text()` — so the type
 * has to be resolved while the tree is still addressable.
 *
 * ### Why it runs after sanitising
 *
 * An imported book's HTML is sanitised before this, so the class is added to a
 * tree that has already been made safe rather than being something a book could
 * have supplied for itself. A book cannot forge a callout class; it can only
 * write the prose that earns one.
 */

/** Emoji prefix → modifier, in the charter's own order. */
const KINDS: ReadonlyArray<readonly [string, string]> = [
  ['📌', 'key'],
  ['🔍', 'how'],
  ['💡', 'tip'],
  ['⚠', 'pitfall'],
  ['📖', 'definition'],
];

/**
 * The callout kind a blockquote opens with, if any.
 *
 * Matches on the bare code point, so `⚠️` (which carries a U+FE0F variation
 * selector that most editors insert invisibly) and `⚠` are the same warning.
 */
function kindOf(blockquote: Element): string | undefined {
  const paragraph = blockquote.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'p',
  );
  const text = paragraph?.children.find((child): child is Text => child.type === 'text');
  const start = text?.value.trimStart();
  if (!start) return undefined;

  return KINDS.find(([emoji]) => start.startsWith(emoji))?.[1];
}

export function rehypeCallouts() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'blockquote') return;

      const kind = kindOf(node);
      if (!kind) return;

      const properties = (node.properties ??= {});
      const existing = properties.className;
      const classes = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
      properties.className = [...classes, 'callout', `callout--${kind}`];
    });
  };
}
