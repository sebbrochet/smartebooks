import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMarkdown } from './render';
import { createIslandRegistry, type IslandDefinition } from '../islandRegistry';
import type { IslandComponentProps } from '../types';
import { attrText } from '../islands/attributes';
import { BookProvider } from '../reader/BookContext';

/**
 * SPEC001 P2.3: islands declare `type: 'asset'` and the engine resolves it,
 * instead of each island hand-checking `startsWith('assets/')`.
 *
 * The check that matters is the security one. An imported book may only play
 * media it actually ships, or a plain `https:` URL — and it must not be able to
 * fake "I ship this" by writing a resolved-looking URL itself.
 *
 * The subject is a fixture rather than a shipped island. Until 2026-09-23 this
 * suite was written against `::audio`, which read as a property of one island
 * when it is a contract of the engine's — and removing the media islands
 * (SPEC016 QB1) would have taken the only tests of that contract with them.
 * Nothing built-in takes an asset now: the chess pack's `pgn` does, and a pack
 * cannot be imported here.
 */
const AssetIsland = ({ attributes, packagedAssets }: IslandComponentProps) => {
  const src = attrText(attributes.src);
  const fromPackage = packagedAssets.includes('src');

  // The rule every asset-taking island owes its readers. It lives in the island
  // because the engine supplies the two facts needed to apply it and takes no
  // view on them: what the attribute resolved to, and whether that resolution
  // came from the package.
  if (!src || (!fromPackage && !src.startsWith('https://'))) {
    return (
      <div className="island island--disabled" role="note">
        blocked
      </div>
    );
  }
  return <div className="island">{src}</div>;
};

const fixture: IslandDefinition[] = [
  { name: 'asset-island', component: AssetIsland, attributes: { src: { type: 'asset' } } },
];

const registry = createIslandRegistry(fixture);
const resolveAsset = (src: string) =>
  src === 'assets/tune.mp3' ? 'blob:resolved-tune' : undefined;

function render(markdown: string, { trusted }: { trusted: boolean }) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry} resolveAsset={resolveAsset}>
      {renderMarkdown(markdown, { registry, trusted, resolveAsset })}
    </BookProvider>,
  );
}

const asset = (src: string) => `::asset-island{id="a" src="${src}"}`;

describe('engine-resolved assets', () => {
  it('resolves a packaged asset to its URL', () => {
    const html = render(asset('assets/tune.mp3'), { trusted: true });
    expect(html).toContain('blob:resolved-tune');
    expect(html).not.toContain('assets/tune.mp3');
  });

  it('leaves an external URL alone', () => {
    const html = render(asset('https://example.com/t.mp3'), { trusted: true });
    expect(html).toContain('https://example.com/t.mp3');
  });

  it('allows a packaged asset in an imported book', () => {
    const html = render(asset('assets/tune.mp3'), { trusted: false });
    expect(html).toContain('blob:resolved-tune');
    expect(html).not.toContain('island--disabled');
  });

  it('allows an https source in an imported book', () => {
    const html = render(asset('https://example.com/t.mp3'), { trusted: false });
    expect(html).not.toContain('island--disabled');
  });

  // The marker rather than the sentence: the sentence is the reader's and is
  // translated (SPEC015 L1.6), and a security test that reads prose stops
  // testing anything the day the prose changes — quietly, if it was a negative.
  it('blocks a non-https source in an imported book', () => {
    const html = render(asset('http://example.com/t.mp3'), { trusted: false });
    expect(html).toContain('island--disabled');
  });

  // The reason `packagedAssets` exists rather than sniffing the resolved value:
  // a book could otherwise claim to ship media by writing a blob: URL itself.
  it('does not let a book fake a packaged asset', () => {
    const html = render(asset('blob:evil'), { trusted: false });
    expect(html).toContain('island--disabled');
  });

  it('blocks an assets/ path the package does not actually contain', () => {
    const html = render(asset('assets/missing.mp3'), { trusted: false });
    expect(html).toContain('island--disabled');
  });
});
