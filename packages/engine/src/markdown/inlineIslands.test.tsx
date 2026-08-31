import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';

/**
 * SPEC001 P2.6 / L12: text directives were accepted by the parser and then
 * compiled exactly like blocks — `hName = 'island'` and `children = []` — so
 * `:term[palimpsest]` emitted a block-ish element *inside a paragraph* and lost
 * the word itself. They now have their own path.
 */
const registry = createIslandRegistry(defaultIslands);

function html(markdown: string, trusted = true) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry}>
      {renderMarkdown(markdown, { registry, trusted })}
    </BookProvider>,
  );
}

describe('inline islands', () => {
  it('keeps the authored label, which used to be discarded', () => {
    expect(html('A :term[palimpsest]{definition="Scraped and reused."} page.')).toContain(
      'palimpsest',
    );
  });

  it('stays inside the paragraph rather than breaking out of it', () => {
    const output = html('A :term[palimpsest]{definition="Scraped and reused."} page.');
    // The whole sentence is one paragraph, and the mark is a span within it —
    // a div here would be invalid HTML and would break the line.
    expect(output).toMatch(/<p>A <span[^>]*>.*palimpsest.*<\/span> page\.<\/p>/s);
    expect(output).not.toMatch(/<p>[^<]*<div/);
  });

  it('makes the word operable, not just decorated', () => {
    const output = html(':term[palimpsest]{definition="Scraped and reused."}');
    expect(output).toContain('<button');
    expect(output).toContain('aria-expanded="false"');
  });

  // The explanation is behind the interaction: showing it inline unasked would
  // be the box in the middle of a paragraph this exists to avoid.
  it('does not show the definition until it is asked for', () => {
    expect(html(':term[palimpsest]{definition="Scraped and reused."}')).not.toContain(
      'Scraped and reused.',
    );
  });

  it('is just the word when there is nothing to explain', () => {
    const output = html('A :term[palimpsest] page.');
    expect(output).toContain('palimpsest');
    expect(output).not.toContain('<button');
  });

  // Fiction, chess and travel guides all want inline marks *inside prose*, so a
  // broken one must never put a placeholder box in the middle of a sentence.
  it('degrades to the plain word when the island is unknown', () => {
    const output = html('A :nosuchthing[palimpsest]{ref="x"} page.');
    expect(output).toContain('palimpsest');
    expect(output).not.toContain('Unknown interactive block');
  });

  it('degrades to the plain word when a block island is written inline', () => {
    const output = html('A :quiz[palimpsest] page.');
    expect(output).toContain('palimpsest');
    expect(output).not.toContain('<div');
  });

  it('survives sanitising in an imported book', () => {
    expect(html('A :term[palimpsest]{definition="Scraped."} page.', false)).toContain('palimpsest');
  });
});

describe('block islands are unaffected', () => {
  it('still replaces the body with the static form', () => {
    const output = html('::checkpoint{id="c1" label="Done"}');
    expect(output).toContain('Done');
  });
});
