import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';

const registry = createIslandRegistry(defaultIslands);

function html(markdown: string, highlightTerms?: string[], trusted = true) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry}>
      {renderMarkdown(markdown, { registry, trusted, highlightTerms })}
    </BookProvider>,
  );
}

describe('marking a search’s terms in the chapter', () => {
  it('marks the terms in the prose', () => {
    const output = html('A token is a unit of text.', ['token']);
    expect(output).toContain('<mark class="term-highlight">token</mark>');
  });

  it('marks regardless of case, and keeps the original casing', () => {
    expect(html('Token and token', ['token'])).toContain(
      '<mark class="term-highlight">Token</mark>',
    );
  });

  it('leaves the chapter alone when the reader did not arrive from a search', () => {
    expect(html('A token is a unit of text.')).not.toContain('mark');
    expect(html('A token is a unit of text.', [])).not.toContain('mark');
  });

  /**
   * A highlight inside a code sample is indistinguishable from syntax, and a
   * search for a word as common as "if" would stripe the whole listing.
   */
  it('does not mark inside code', () => {
    const output = html('A token in prose, and `token` in code.\n\n```js\nconst token = 1;\n```', [
      'token',
    ]);

    // Marked once, in the prose — not in the code span or the fenced block.
    expect(output.match(/term-highlight/g)).toHaveLength(1);
    expect(output).not.toMatch(/<code[^>]*>[^<]*<mark/);
  });

  /**
   * The engine's own elements. An island reads its children as a label or its
   * config from an attribute; injecting elements hands it something other than
   * the text it was given.
   */
  it('does not reach inside an island', () => {
    const markdown = [
      'A token in the prose.',
      '',
      ':::quiz{id="q"}',
      '### Is this a token?',
      '',
      '- [x] Yes',
      ':::',
    ].join('\n');

    const output = html(markdown, ['token']);
    expect(output).toContain('<mark class="term-highlight">token</mark>');
    // The quiz's own question is inside an island and is left untouched.
    expect(output).not.toContain('<mark class="term-highlight">token</mark>?');
  });

  it('marks every occurrence, not just the first', () => {
    const output = html('token and token and token', ['token']);
    expect(output.match(/term-highlight/g)).toHaveLength(3);
  });

  // The terms travel per render on the file. The processor is cached per book,
  // so a query leaking into the next chapter would mark words nobody searched.
  it('does not leak one render’s terms into the next', () => {
    html('A token is a unit.', ['token']);
    expect(html('A token is a unit.')).not.toContain('mark');
  });
});
