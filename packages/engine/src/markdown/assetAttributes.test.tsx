import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMarkdown } from './render';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider } from '../reader/BookContext';

/**
 * SPEC001 P2.3: islands declare `type: 'asset'` and the engine resolves it,
 * instead of each island hand-checking `startsWith('assets/')`.
 *
 * The check that matters is the security one. An imported book may only play
 * media it actually ships, or a plain `https:` URL — and it must not be able to
 * fake "I ship this" by writing a resolved-looking URL itself.
 */
const registry = createIslandRegistry(defaultIslands);
const resolveAsset = (src: string) =>
  src === 'assets/tune.mp3' ? 'blob:resolved-tune' : undefined;

function render(markdown: string, { trusted }: { trusted: boolean }) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry} resolveAsset={resolveAsset}>
      {renderMarkdown(markdown, { registry, trusted, resolveAsset })}
    </BookProvider>,
  );
}

describe('engine-resolved assets', () => {
  it('resolves a packaged asset to its URL', () => {
    const html = render('::audio{id="a" src="assets/tune.mp3"}', { trusted: true });
    expect(html).toContain('blob:resolved-tune');
    expect(html).not.toContain('assets/tune.mp3');
  });

  it('leaves an external URL alone', () => {
    const html = render('::audio{id="a" src="https://example.com/t.mp3"}', { trusted: true });
    expect(html).toContain('https://example.com/t.mp3');
  });

  it('allows a packaged asset in an imported book', () => {
    const html = render('::audio{id="a" src="assets/tune.mp3"}', { trusted: false });
    expect(html).toContain('blob:resolved-tune');
    expect(html).not.toContain('blocked');
  });

  it('allows an https source in an imported book', () => {
    const html = render('::audio{id="a" src="https://example.com/t.mp3"}', { trusted: false });
    expect(html).not.toContain('blocked');
  });

  it('blocks a non-https source in an imported book', () => {
    const html = render('::audio{id="a" src="http://example.com/t.mp3"}', { trusted: false });
    expect(html).toContain('blocked');
  });

  // The reason `packagedAssets` exists rather than sniffing the resolved value:
  // a book could otherwise claim to ship media by writing a blob: URL itself.
  it('does not let a book fake a packaged asset', () => {
    const html = render('::audio{id="a" src="blob:evil"}', { trusted: false });
    expect(html).toContain('blocked');
  });

  it('blocks an assets/ path the package does not actually contain', () => {
    const html = render('::audio{id="a" src="assets/missing.mp3"}', { trusted: false });
    expect(html).toContain('blocked');
  });

  it('still resolves for video, which shares the mechanism', () => {
    const html = render('::video{id="v" src="assets/tune.mp3"}', { trusted: false });
    expect(html).toContain('blob:resolved-tune');
  });
});
