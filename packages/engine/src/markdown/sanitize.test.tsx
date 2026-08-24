import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement } from 'react';
import { renderMarkdown } from './render';
import { BookProvider } from '../reader/BookContext';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';

// Imported books are rendered untrusted, with the built-in island set.
const registry = createIslandRegistry(defaultIslands);

describe('renderMarkdown sanitization (untrusted)', () => {
  it('strips javascript: links in untrusted content', () => {
    const html = renderToStaticMarkup(
      <>{renderMarkdown('[click me](javascript:alert(1))', { trusted: false, registry })}</>,
    );
    expect(html).toContain('click me');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('keeps a normal https link in untrusted content', () => {
    const html = renderToStaticMarkup(
      <>{renderMarkdown('[docs](https://example.com)', { trusted: false, registry })}</>,
    );
    expect(html).toContain('href="https://example.com"');
  });

  it('disables an island marked disabledWhenUntrusted', () => {
    // Policy hook: a book may declare an island that is inert in imported books.
    const risky = createIslandRegistry([
      { name: 'risky', component: () => <b>interactive</b>, disabledWhenUntrusted: true },
    ]);
    const node = renderMarkdown(':::risky{id="p"}\n```js\nalert(1)\n```\n:::\n', {
      trusted: false,
      registry: risky,
    });
    const html = renderToStaticMarkup(
      <BookProvider slug="x" trusted={false} registry={risky}>
        {node}
      </BookProvider>,
    );
    expect(html).toMatch(/disabled in imported books/i);
    expect(html).not.toContain('interactive</b>');
  });

  it('still renders islands for trusted content', () => {
    expect(
      isValidElement(renderMarkdown('::checkpoint{id="c" label="Done"}\n', { registry })),
    ).toBe(true);
  });

  it('rewrites in-package image assets via the resolver', () => {
    const html = renderToStaticMarkup(
      <>
        {renderMarkdown('![pixel](assets/pixel.png)', {
          trusted: false,
          registry,
          resolveAsset: (src) => (src === 'assets/pixel.png' ? 'blob:fake-url' : undefined),
        })}
      </>,
    );
    expect(html).toContain('src="blob:fake-url"');
  });
});
