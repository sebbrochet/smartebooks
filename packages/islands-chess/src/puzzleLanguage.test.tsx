// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessagesProvider } from '@smart-ebooks/engine';
import { DEFAULT_BOARD_OPTIONS } from './boardOptions';
import ChessPuzzleIsland from './ChessPuzzleIsland';

vi.mock('idb-keyval', () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
  entries: async () => [],
  createStore: () => undefined,
}));

const FEN = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

/**
 * The puzzle's controls are furniture, not the book's prose (SPEC015 §2), so
 * they follow the shell's language — a French reader was being told "Your move."
 */
function shown(language: 'en' | 'fr', attributes: Record<string, string>) {
  return renderToStaticMarkup(
    <MessagesProvider language={language}>
      <ChessPuzzleIsland
        id="p"
        attributes={attributes}
        packagedAssets={[]}
        data={{ fen: FEN, solution: attributes.solution, board: DEFAULT_BOARD_OPTIONS }}
      />
    </MessagesProvider>,
  );
}

describe('a chess puzzle in a French shell', () => {
  it('speaks French while waiting for the move', () => {
    const html = shown('fr', { solution: 'Ra8#', hint: 'La dernière rangée.' });

    expect(html).toContain('À vous de jouer.');
    expect(html).toContain('Indice');
    expect(html).not.toContain('Your move');
    expect(html).not.toMatch(/>Hint</);
  });

  it('speaks French in the reveal-only form', () => {
    const html = shown('fr', {});

    expect(html).toContain('Afficher la solution');
    expect(html).toContain('Résolu');
    expect(html).not.toContain('Reveal solution');
    expect(html).not.toMatch(/Solved/);
  });

  it('still reads English on an English device', () => {
    expect(shown('en', { solution: 'Ra8#' })).toContain('Your move.');
  });
});
