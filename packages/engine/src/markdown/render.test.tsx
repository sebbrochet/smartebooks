import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
import { renderMarkdown } from './render';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';

const registry = createIslandRegistry(defaultIslands);

describe('renderMarkdown', () => {
  it('renders prose and interactive directives into a React tree', () => {
    const node = renderMarkdown(
      ['# Title', '', 'Some prose.', '', '::checkpoint{id="c1" label="Done"}', ''].join('\n'),
      { registry },
    );
    expect(isValidElement(node)).toBe(true);
  });

  it('does not throw on unknown directives', () => {
    expect(() => renderMarkdown('::unknownthing{id="x"}\n', { registry })).not.toThrow();
  });
});
