import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMarkdown } from './render';
import { BookProvider } from '../reader/BookContext';
import { createIslandRegistry, type IslandDefinition } from '../islandRegistry';

const demo = (name: string): IslandDefinition => ({
  name,
  component: () => <b>island:{name}</b>,
});

describe('per-book island scoping', () => {
  const registry = createIslandRegistry([demo('demo')]);

  function render(markdown: string): string {
    return renderToStaticMarkup(
      <BookProvider slug="t" registry={registry}>
        {renderMarkdown(markdown, { registry })}
      </BookProvider>,
    );
  }

  it('renders an island that the book declares', () => {
    expect(render('::demo{id="d"}\n')).toContain('island:demo');
  });

  it('renders "unknown" for a directive outside the book’s registry', () => {
    const html = render('::chessboard{id="c"}\n');
    expect(html).toContain('Unknown interactive block');
    expect(html).not.toContain('island:demo');
  });

  it('gives two books different vocabularies for the same markdown', () => {
    const other = createIslandRegistry([demo('chessboard')]);
    const html = renderToStaticMarkup(
      <BookProvider slug="other" registry={other}>
        {renderMarkdown('::chessboard{id="c"}\n', { registry: other })}
      </BookProvider>,
    );
    expect(html).toContain('island:chessboard');
  });
});
