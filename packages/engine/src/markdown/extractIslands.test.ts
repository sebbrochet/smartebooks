import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import { extractFlashcard, extractJsonConfig } from './extract';

function findDirective(markdown: string, name: string): unknown {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(markdown);
  let found: unknown = null;
  visit(tree as Root, (node) => {
    const n = node as unknown as { type: string; name?: string };
    if (n.type === 'containerDirective' && n.name === name) found = node;
  });
  return found;
}

describe('extractFlashcard', () => {
  it('splits front and back and strips the labels', () => {
    const md = [
      ':::flashcard{id="c"}',
      '**Front:** What is a token?',
      '',
      '**Back:** A sub-word unit of text.',
      ':::',
      '',
    ].join('\n');

    const card = extractFlashcard(findDirective(md, 'flashcard'));
    expect(card.front).toBe('What is a token?');
    expect(card.back).toBe('A sub-word unit of text.');
  });
});

describe('extractJsonConfig', () => {
  it('parses a fenced JSON code block body', () => {
    const md = [
      ':::matchingpairs{id="g"}',
      '```json',
      '{ "pairs": [["a", "b"], ["c", "d"]] }',
      '```',
      ':::',
      '',
    ].join('\n');

    const config = extractJsonConfig(findDirective(md, 'matchingpairs')) as { pairs: string[][] };
    expect(config.pairs).toHaveLength(2);
    expect(config.pairs[0]).toEqual(['a', 'b']);
  });

  it('returns an empty object for invalid config', () => {
    const md = [':::matchingpairs{id="g"}', 'not json at all', ':::', ''].join('\n');
    expect(extractJsonConfig(findDirective(md, 'matchingpairs'))).toEqual({});
  });
});
