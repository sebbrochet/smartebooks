import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';

/**
 * An island's `id` is not a DOM id — it is the key the island saves the
 * reader's answers under. It used to travel in an attribute called `id`, and
 * `rehype-sanitize` (applied to imported books, and only to those) rewrites
 * `id` to `user-content-<id>` to stop untrusted markup shadowing DOM
 * properties. That protection is right for prose and wrong here: it meant the
 * same book saved to `score:ch1` when bundled and `score:user-content-ch1`
 * when imported, and nothing could join a stored score back to the chapter
 * that earned it.
 *
 * The attribute is now `islandId`, which is not in the clobber list.
 */
const registry = createIslandRegistry([
  {
    name: 'probe',
    component: ({ id }: { id: string }) => <output data-key={id}>{id}</output>,
  },
]);

function keyGivenToIsland(trusted: boolean): string {
  const markup = renderToStaticMarkup(
    <BookProvider slug="demo" trusted={trusted} registry={registry}>
      {renderMarkdown(':::probe{id="ch1-basics"}\n:::\n', { registry, trusted })}
    </BookProvider>,
  );
  return markup.match(/data-key="([^"]*)"/)?.[1] ?? '';
}

describe('the key an island persists under', () => {
  it('is the authored id in a bundled book', () => {
    expect(keyGivenToIsland(true)).toBe('ch1-basics');
  });

  it('is the same authored id in an imported, sanitised book', () => {
    expect(keyGivenToIsland(false)).toBe('ch1-basics');
  });

  /**
   * The clobbering itself is kept: it is a real defence for prose, where an
   * author-chosen `id` reaches the DOM.
   */
  it('still clobbers an id on ordinary prose in an untrusted book', () => {
    const markup = renderToStaticMarkup(
      <BookProvider slug="demo" trusted={false} registry={registry}>
        {renderMarkdown('<p id="body">Text.</p>\n', { registry, trusted: false })}
      </BookProvider>,
    );
    expect(markup).not.toContain('id="body"');
  });
});
