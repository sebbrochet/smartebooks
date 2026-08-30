import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import { extractQuiz, extractFlashcard, extractJsonConfig } from './extract';

/**
 * markdownlint's MD022 (blanks-around-headings) fires on the compact style used
 * in the bundled books, where a `###` question sits directly under the opening
 * `:::quiz{…}` line. Adding those blank lines must not change what an island
 * extracts — this asserts that the two forms are equivalent.
 */
function directive(markdown: string, name: string): unknown {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(markdown);
  let found: unknown = null;
  visit(tree as Root, (node) => {
    const n = node as unknown as { type: string; name?: string };
    if (n.type === 'containerDirective' && n.name === name) found = node;
  });
  return found;
}

describe('blank lines inside a container directive', () => {
  it('does not change what a quiz extracts', () => {
    const compact = [
      ':::quiz{id="q"}',
      '### What is a token?',
      '',
      '- [ ] A sentence',
      '- [x] A sub-word chunk',
      '',
      '> Explanation: sub-word units.',
      '',
      '### Second question',
      '',
      '- [x] Yes',
      ':::',
      '',
    ].join('\n');

    const spaced = [
      ':::quiz{id="q"}',
      '',
      '### What is a token?',
      '',
      '- [ ] A sentence',
      '- [x] A sub-word chunk',
      '',
      '> Explanation: sub-word units.',
      '',
      '### Second question',
      '',
      '- [x] Yes',
      '',
      ':::',
      '',
    ].join('\n');

    const fromCompact = extractQuiz(directive(compact, 'quiz'));
    expect(fromCompact).toHaveLength(2);
    expect(extractQuiz(directive(spaced, 'quiz'))).toEqual(fromCompact);
  });

  it('does not change what a flashcard extracts', () => {
    const compact = ':::flashcard{id="c"}\n**Front:** Q?\n\n**Back:** A.\n:::\n';
    const spaced = ':::flashcard{id="c"}\n\n**Front:** Q?\n\n**Back:** A.\n\n:::\n';

    const fromCompact = extractFlashcard(directive(compact, 'flashcard'));
    expect(fromCompact.front).toBe('Q?');
    expect(extractFlashcard(directive(spaced, 'flashcard'))).toEqual(fromCompact);
  });

  it('does not change a fenced JSON body', () => {
    const body = '```json\n{ "pairs": [["a", "b"]] }\n```';
    const compact = `:::matching-pairs{id="m"}\n${body}\n:::\n`;
    const spaced = `:::matching-pairs{id="m"}\n\n${body}\n\n:::\n`;

    const fromCompact = extractJsonConfig(directive(compact, 'matching-pairs'));
    expect(fromCompact).toEqual({ pairs: [['a', 'b']] });
    expect(extractJsonConfig(directive(spaced, 'matching-pairs'))).toEqual(fromCompact);
  });
});
