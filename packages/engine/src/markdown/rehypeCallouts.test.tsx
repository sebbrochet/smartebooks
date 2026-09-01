import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';

/**
 * The editorial charter has defined five callout kinds since it was written,
 * and every one of them rendered as the same blockquote. An author following
 * the contract exactly got a grey left border and no distinction at all.
 */
const registry = createIslandRegistry(defaultIslands);

function html(markdown: string, trusted = true) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry}>
      {renderMarkdown(markdown, { registry, trusted })}
    </BookProvider>,
  );
}

describe('callouts', () => {
  it('marks each kind the charter defines', () => {
    const kinds: [string, string][] = [
      ['📌 **Key concept**: a token is a chunk of text.', 'callout--key'],
      ['🔍 **How it works**: the model predicts the next token.', 'callout--how'],
      ['💡 **Tip**: keep prompts short.', 'callout--tip'],
      ['⚠️ **Pitfall**: it will invent citations.', 'callout--pitfall'],
      ['📖 **Definition — Token**: a sub-word unit.', 'callout--definition'],
    ];

    for (const [body, expected] of kinds) {
      const output = html(`> ${body}`);
      expect(output).toContain('class="callout ');
      expect(output).toContain(expected);
    }
  });

  // The variation selector is invisible in an editor and most keyboards insert
  // it, so matching the bare code point is the difference between the rule
  // working and the rule working on the author's machine only.
  it('treats ⚠ and ⚠️ as the same warning', () => {
    expect(html('> \u26a0 **Pitfall**: bare.')).toContain('callout--pitfall');
    expect(html('> \u26a0\ufe0f **Pitfall**: with selector.')).toContain('callout--pitfall');
  });

  it('leaves an ordinary blockquote alone', () => {
    const output = html('> Just a quotation, making no claim to be anything more.');
    expect(output).toContain('<blockquote>');
    expect(output).not.toContain('class=');
  });

  // The emoji is the author's text, it is what makes the convention greppable,
  // and it is the only marker that survives an export with no stylesheet.
  it('keeps the author’s prefix rather than replacing it with an icon', () => {
    expect(html('> 💡 **Tip**: keep prompts short.')).toContain('💡');
  });

  it('works in an imported book, where the markup is sanitised first', () => {
    const output = html('> 💡 **Tip**: keep prompts short.', false);
    expect(output).toContain('callout--tip');
  });

  it('only reads the opening paragraph, not an emoji further down', () => {
    const output = html('> An ordinary quote.\n>\n> 💡 mentioned later.');
    expect(output).not.toContain('callout');
  });
});
