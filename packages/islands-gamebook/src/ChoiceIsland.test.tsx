import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookProvider, UnitProvider, createIslandRegistry } from '@smart-ebooks/engine';
import ChoiceIsland from './ChoiceIsland';

const registry = createIslandRegistry([]);

/*
 * `UnitProvider` is what makes this the *offered* state. Without it the island
 * has no unit, takes the early return meant for a choice with no destination,
 * and every assertion below passes against the branch nobody reads.
 */
function offered(language: string | undefined, children?: React.ReactNode) {
  return renderToStaticMarkup(
    <BookProvider slug="book" trusted registry={registry} language={language}>
      <UnitProvider unit="12">
        <ChoiceIsland id="i" packagedAssets={[]} attributes={{ to: '45' }}>
          {children}
        </ChoiceIsland>
      </UnitProvider>
    </BookProvider>,
  );
}

/*
 * The printed line is the source rather than a degradation of it (§5.1), so a
 * gamebook may never render a choice without saying where it leads — and the
 * live section is the one place the reader needs it.
 */
describe('a choice being offered', () => {
  it('names its destination when the author wrote no label', () => {
    expect(offered('en')).toContain('turn to 45');
  });

  it('names its destination when the author wrote a label too', () => {
    const html = offered('en', 'If you open the door');

    expect(html).toContain('If you open the door');
    expect(html).toContain('turn to 45');
  });

  it('says it in the book’s own language', () => {
    expect(offered('fr', 'Si vous ouvrez la porte')).toContain('rendez-vous au 45');
  });
});
