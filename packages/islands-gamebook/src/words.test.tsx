import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookProvider, createIslandRegistry } from '@smart-ebooks/engine';
import EndingIsland from './EndingIsland';
import ChoiceIsland from './ChoiceIsland';
import { wordsFor } from './words';

const registry = createIslandRegistry([]);

function inA(language: string | undefined, children: React.ReactNode) {
  return renderToStaticMarkup(
    <BookProvider slug="book" trusted registry={registry} language={language}>
      {children}
    </BookProvider>,
  );
}

const props = { id: 'i', packagedAssets: [] as readonly string[], attributes: {} };

describe('wordsFor', () => {
  it('speaks English when a book says nothing', () => {
    expect(wordsFor(undefined).turnTo('45')).toBe('turn to 45');
  });

  it('speaks the genre, not a translation', () => {
    expect(wordsFor('fr').turnTo('45')).toBe('rendez-vous au 45');
    expect(wordsFor('fr').returnTo('4')).toBe('revenez au 4');
  });

  // A region is not a different book: fr-CA reads the French one.
  it('matches on the primary subtag', () => {
    expect(wordsFor('fr-CA').beginAgain).toBe(wordsFor('fr').beginAgain);
    expect(wordsFor('FR').beginAgain).toBe(wordsFor('fr').beginAgain);
  });

  it('falls back to English rather than showing a book nothing', () => {
    expect(wordsFor('qq').turnTo('45')).toBe('turn to 45');
  });

  it("keeps the author's label and adds the printed line to it", () => {
    expect(wordsFor('fr').choice('Ouvrez la porte', '3')).toBe(
      'Ouvrez la porte — rendez-vous au 3',
    );
    expect(wordsFor('fr').choice('', '3')).toBe('rendez-vous au 3');
  });

  /**
   * The reason these are whole sentences rather than fragments: the plural
   * rules differ, and French keeps the singular at zero where English does not.
   */
  it('counts in each language’s own way', () => {
    expect(wordsFor('en').sectionsRead(1, [])).toBe('You have read 1 section.');
    expect(wordsFor('en').sectionsRead(0, [])).toBe('You have read 0 sections.');
    expect(wordsFor('fr').sectionsRead(0, [])).toBe('Vous avez lu 0 section.');
    expect(wordsFor('fr').sectionsRead(2, [])).toBe('Vous avez lu 2 sections.');
  });

  it('names the sections never seen, in the book’s language', () => {
    expect(wordsFor('en').sectionsRead(3, ['2', '4'])).toMatch(/never seen 2, 4\.$/);
    expect(wordsFor('fr').sectionsRead(3, ['2', '4'])).toMatch(/jamais vu 2, 4\.$/);
  });
});

/**
 * The wiring, which is the half a table of strings cannot prove: that the
 * book's declared language reaches an island at all. Before this, a French book
 * printed `turn to 45` in the middle of a French sentence.
 */
describe('a book in French', () => {
  it('ends its story in French', () => {
    expect(inA('fr', <EndingIsland {...props} />)).toContain('Votre aventure s’achève ici.');
  });

  it('offers its choices in French', () => {
    expect(inA('fr', <ChoiceIsland {...props} attributes={{ to: '45' }} />)).toContain(
      'rendez-vous au 45',
    );
  });

  it('still reads English when the book declares none', () => {
    expect(inA(undefined, <ChoiceIsland {...props} attributes={{ to: '45' }} />)).toContain(
      'turn to 45',
    );
  });
});
