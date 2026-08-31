import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType, ReactNode } from 'react';
import { createIslandRegistry } from '../islandRegistry';
import type { IslandComponentProps } from '../types';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';
import { extractDirectiveCode } from './extract';

/**
 * SPEC001 P2.10a: an island that renders its own children.
 *
 * Every island before this one *replaced* its body — with a static fallback at
 * parse time, and with its own component at run time. A container island is the
 * opposite: the body is the page, and the island only coordinates what is in
 * it. The two rules that fall out are that the children must survive
 * compilation, and that the island's configuration must not be printed as
 * content.
 */
function Box({ children }: IslandComponentProps) {
  return <section data-testid="box">{children as ReactNode}</section>;
}

const registry = createIslandRegistry([
  {
    name: 'box',
    attributes: {},
    component: Box as ComponentType<IslandComponentProps>,
    rendersChildren: true,
    extract: (node) => ({ config: extractDirectiveCode(node, { consume: true }) }),
  },
  {
    name: 'plain',
    attributes: {},
    component: Box as ComponentType<IslandComponentProps>,
    fallback: () => [{ type: 'paragraph', children: [{ type: 'text', value: 'Static form.' }] }],
  },
]);

function html(markdown: string, trusted = true) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry}>
      {renderMarkdown(markdown, { registry, trusted })}
    </BookProvider>,
  );
}

const BOOK = [
  ':::box{id="b"}',
  '',
  '```json',
  '{ "secret": 1 }',
  '```',
  '',
  'The prose the author wrote.',
  '',
  ':::',
  '',
].join('\n');

describe('islands that render their children', () => {
  it('keeps the authored body instead of replacing it', () => {
    const output = html(BOOK);
    expect(output).toContain('The prose the author wrote.');
    expect(output).toContain('data-testid="box"');
  });

  it('does not print the configuration block the island consumed', () => {
    expect(html(BOOK)).not.toContain('secret');
  });

  it('renders the children inside the island, not beside it', () => {
    expect(html(BOOK)).toMatch(/<section[^>]*><p>The prose the author wrote\.<\/p><\/section>/);
  });

  // The behaviour every other island still has, so the new flag is opt-in
  // rather than a change of meaning for the ones already written.
  it('leaves an ordinary island replacing its body with its fallback', () => {
    const output = html(':::plain{id="p"}\n\nThe prose the author wrote.\n:::\n');
    expect(output).not.toContain('The prose the author wrote.');
  });

  it('survives sanitising in an imported book', () => {
    expect(html(BOOK, false)).toContain('The prose the author wrote.');
  });
});
