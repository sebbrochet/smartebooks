import { describe, it, expect } from 'vitest';
import { toString } from 'mdast-util-to-string';
import type { RootContent } from 'mdast';
import { chessIslands } from './index';

/**
 * SPEC008 C1/C2: every chess island exported *blank space* — in print, in
 * EPUB, with no JavaScript, and to a search indexer — because the pack was
 * filed as picture-shaped. Only the diagram is. These are the fallbacks that
 * follow from noticing that.
 */
const island = (name: string) => {
  const found = chessIslands().find((i) => i.name === name);
  if (!found) throw new Error(`no island named ${name}`);
  return found;
};

const run = (name: string, data: unknown, attributes: Record<string, string | boolean> = {}) =>
  island(name).fallback?.({} as never, data, { attributes });

const text = (nodes: RootContent[] | undefined) =>
  (nodes ?? []).map((node) => toString(node)).join('\n');

describe('chess-board fallback', () => {
  const pgn =
    "{Scholar's Mate.} 1. e4 e5 2. Bc4 {White eyes f7. [%cal Gc4f7]} Nc6 3. Qh5?! {Premature.}";

  it('prints the game the way a chess book prints it', () => {
    expect(text(run('chess-board', { pgn }))).toBe(
      ["Scholar's Mate.", '1. e4 e5 2. Bc4', 'White eyes f7.', 'Nc6 3. Qh5?!', 'Premature.'].join(
        '\n',
      ),
    );
  });

  // The tags are drawn on a board that an export does not have.
  it('does not leak shape tags into the exported prose', () => {
    expect(text(run('chess-board', { pgn }))).not.toContain('%cal');
  });

  it('emits nothing at all for a board with no game', () => {
    expect(run('chess-board', { pgn: '' })).toBeUndefined();
    expect(run('chess-board', {})).toBeUndefined();
    expect(run('chess-board', undefined)).toBeUndefined();
  });
});

describe('chess-puzzle fallback', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

  it('keeps the position and the answer', () => {
    const out = text(run('chess-puzzle', { fen, solution: 'Ra8# — a back-rank mate.' }));
    expect(out).toContain(fen);
    expect(out).toContain('Ra8#');
  });

  it('is still useful for a puzzle with no written solution', () => {
    expect(text(run('chess-puzzle', { fen, solution: '  ' }))).toContain(fen);
  });

  it('emits nothing without a position', () => {
    expect(run('chess-puzzle', { fen: '' })).toBeUndefined();
  });
});

describe('chess-diagram fallback', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

  it('emits the caption and the position', () => {
    const out = text(run('chess-diagram', { fen, caption: 'White to move.' }));
    expect(out).toContain('White to move.');
    expect(out).toContain(fen);
  });

  it('emits nothing without a position', () => {
    expect(run('chess-diagram', { caption: 'White to move.' })).toBeUndefined();
  });
});

describe('chess-analysis fallback', () => {
  // An engine cannot run in an export, so only a *stated* evaluation can
  // appear. With none there is nothing honest to say.
  it('emits the annotator’s evaluation when there is one', () => {
    const out = text(run('chess-analysis', undefined, { eval: '+0.20', best: 'a6' }));
    expect(out).toContain('+0.20');
    expect(out).toContain('a6');
  });

  it('emits nothing when the evaluation was left to the engine', () => {
    expect(run('chess-analysis', undefined, { fen: 'whatever' })).toBeUndefined();
  });
});
