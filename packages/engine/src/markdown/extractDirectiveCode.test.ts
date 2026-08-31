import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import { extractDirectiveCode } from './extract';

function container(markdown: string): { children: unknown[] } {
  const tree = unified().use(remarkParse).use(remarkDirective).parse(markdown);
  let found: { children: unknown[] } | undefined;
  visit(tree as Root, (node) => {
    if ((node as { type: string }).type === 'containerDirective') {
      found = node as unknown as { children: unknown[] };
    }
  });
  if (!found) throw new Error('no container directive in fixture');
  return found;
}

const MARKDOWN = [
  ':::chess-game{id="g"}',
  '',
  '```pgn',
  '1. e4 e5',
  '```',
  '',
  'The opening.',
  ':::',
  '',
].join('\n');

describe('extractDirectiveCode', () => {
  it('reads the first fenced block and leaves the body alone', () => {
    const node = container(MARKDOWN);
    const before = node.children.length;

    expect(extractDirectiveCode(node)).toBe('1. e4 e5');
    expect(node.children.length).toBe(before);
  });

  it('removes the block when asked to consume it', () => {
    const node = container(MARKDOWN);

    expect(extractDirectiveCode(node, { consume: true })).toBe('1. e4 e5');

    // What is left is the prose, and only the prose: an island that renders its
    // own children would otherwise print the PGN above the game.
    const types = node.children.map((child) => (child as { type: string }).type);
    expect(types).toEqual(['paragraph']);
  });

  it('leaves a body with no fenced block untouched', () => {
    const node = container(':::note\n\nJust prose.\n:::\n');

    expect(extractDirectiveCode(node, { consume: true })).toBeUndefined();
    expect(node.children.length).toBe(1);
  });
});
