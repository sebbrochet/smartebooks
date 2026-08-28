import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root, RootContent } from 'mdast';
import { remarkIslands } from './remarkIslands';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';

/**
 * SPEC001 L1/P1.1: a book must still read as a coherent document when the
 * interactivity is stripped.
 *
 * The static form lives in the compiled *tree* — `IslandHost` ignores it and
 * mounts the component instead — so these tests assert on the tree an exporter
 * will consume, not on what the live app renders.
 */
const registry = createIslandRegistry(defaultIslands);

function compile(markdown: string): Root {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkIslands, registry)
    .runSync(
      unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(markdown),
    ) as Root;
}

/** The static form the exporter would render for the first island found. */
function staticForm(markdown: string): RootContent[] {
  const tree = compile(markdown);
  let children: RootContent[] = [];
  visit(tree, (node) => {
    const directive = node as { data?: { hName?: string }; children?: RootContent[] };
    if (directive.data?.hName === 'island' && children.length === 0) {
      children = directive.children ?? [];
    }
  });
  return children;
}

/** All text in a subtree, as an exporter would flatten it. */
function textOf(nodes: RootContent[]): string {
  const out: string[] = [];
  for (const node of nodes) {
    visit(node, 'text', (text: { value: string }) => {
      out.push(text.value);
    });
  }
  return out.join(' ');
}

const QUIZ = `:::quiz{id="q1"}

### What is 2 + 2?

- [ ] Three
- [x] Four

> Adding two twos.

:::`;

describe('island fallbacks', () => {
  it('keeps a quiz readable, answer key included', () => {
    const text = textOf(staticForm(QUIZ));
    expect(text).toContain('What is 2 + 2?');
    expect(text).toContain('Three');
    expect(text).toContain('Four');
    // The answer lives in the `- [x]` marker rather than in the prose, so it
    // has to be derived from the parsed data, not copied from the body.
    expect(text).toContain('correct');
    expect(text).toContain('Adding two twos.');
  });

  it('prints a flashcard as term — definition', () => {
    const text = textOf(
      staticForm(':::flashcard{id="f1"}\n\n**Front:** Island\n\n**Back:** A component\n\n:::'),
    );
    expect(text).toContain('Island');
    expect(text).toContain('A component');
  });

  it('prints a checkpoint as its own label', () => {
    const text = textOf(staticForm('::checkpoint{id="c1" label="Finished chapter one"}'));
    expect(text).toContain('Checkpoint: Finished chapter one');
  });

  it('uses the schema default when the author gave no label', () => {
    expect(textOf(staticForm('::checkpoint{id="c1"}'))).toContain('Mark this section as complete');
  });

  // An island with no fallback contributes nothing, rather than dumping its raw
  // body — which for a data-bodied island is a JSON or PGN blob, and printing
  // that is worse than printing nothing (SPEC001 Q2).
  it('emits nothing for an island that declares no fallback', () => {
    const form = staticForm(
      ':::matching-pairs{id="m1"}\n\n```json\n{ "pairs": [["a", "b"]] }\n```\n\n:::',
    );
    expect(form).toEqual([]);
  });

  it('produces content nodes, not raw HTML', () => {
    // Everything is ordinary mdast, so it escapes on the way out and cannot
    // smuggle markup in from an imported book.
    const form = staticForm(
      ':::flashcard{id="f1"}\n\n**Front:** <img src=x onerror=alert(1)>\n\n**Back:** ok\n\n:::',
    );
    const types = new Set<string>();
    for (const node of form) {
      visit(node, (n: { type: string }) => {
        types.add(n.type);
      });
    }
    expect(types.has('html')).toBe(false);
    expect(types.has('raw')).toBe(false);
  });

  it('still carries the live island config alongside the static form', () => {
    const tree = compile(QUIZ);
    let properties: Record<string, unknown> | undefined;
    visit(tree, (node) => {
      const directive = node as {
        data?: { hName?: string; hProperties?: Record<string, unknown> };
      };
      if (directive.data?.hName === 'island') properties ??= directive.data.hProperties;
    });
    expect(properties?.type).toBe('quiz');
    expect(String(properties?.config)).toContain('What is 2 + 2?');
  });
});
