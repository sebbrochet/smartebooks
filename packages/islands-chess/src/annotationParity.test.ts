import { describe, it, expect } from 'vitest';
import { pgnToTree, mainline } from './tree';
import { pgnScoreText } from './score';

/**
 * A comment reaches the reader by two routes: replayed through `pgnToTree` for
 * the live board and move list, and split straight out of the PGN text by
 * `pgnScoreText` for the static form. They share one stripper today
 * (`extractAnnotations`), and this is what stops that becoming two again —
 * SPEC008 QC9 already flagged this pair as the drift-prone one.
 *
 * The PGN below is not invented. Every shape in it was taken from exported
 * games: padded braces, tags jammed together with no separator, several
 * comments on one move, a tag family nobody here has heard of, and prose
 * carrying a URL and commas.
 */
const PGN = [
  '[Event "Parity"]',
  '',
  '1. d4 { [%eval 0.15] } 1... Nf6 { [%eval 0.15] } { A45 Indian Defense }',
  '2. Nc3 { [%eval -0.02] } 2... g6?! { [%eval 0.54] } { Inaccuracy. d5 was best. }',
  '{ [%csl Ge4][%cal Ge2e4] }',
  '3. e4 { [%eval 0.56] [%csl Gd6][%cal Gd7d6] }',
  '3... d6 {[%ts 0:22] [%eval 0.51] See https://example.com/a,b for more.}',
  '4. Bf4 { [%clk 0:03:00] }',
].join('\n');

/** Anything a reader is shown, from either route. */
const readerText = () => {
  const fromTree = mainline(pgnToTree(PGN)).map((node) => node.comment);
  const { intro, blocks } = pgnScoreText(PGN);
  return [...fromTree, intro, ...blocks.map((block) => block.comment)];
};

describe('the two comment paths agree about what a reader sees', () => {
  // The invariant that matters, and the one that survives the two paths
  // grouping comments differently: machine text never reaches the page by
  // either route. Until 2026-09-30 both leaked every tag but `%cal` / `%csl`.
  it('leaks no annotation tag by either route', () => {
    for (const text of readerText()) {
      expect(text ?? '').not.toMatch(/\[%/);
    }
  });

  it('strips a tag family neither path has heard of', () => {
    for (const text of readerText()) {
      expect(text ?? '').not.toMatch(/clk|0:03:00|0:22/);
    }
  });

  // Positive half: stripping everything would also pass the checks above.
  it('keeps the prose each path is carrying', () => {
    const joined = readerText()
      .filter((text): text is string => Boolean(text))
      .join(' | ');

    expect(joined).toMatch(/A45 Indian Defense/);
    expect(joined).toMatch(/Inaccuracy\. d5 was best\./);
    expect(joined).toMatch(/See https:\/\/example\.com\/a,b for more\./);
  });

  it('produces the same set of comments from both routes', () => {
    const normalise = (values: (string | undefined)[]) =>
      values.filter((value): value is string => Boolean(value)).sort();

    const fromTree = normalise(mainline(pgnToTree(PGN)).map((node) => node.comment));
    const { intro, blocks } = pgnScoreText(PGN);
    const fromText = normalise([intro, ...blocks.map((block) => block.comment)]);

    // The text path joins consecutive comments into the block they close, and
    // so does `annotate`, so the two lists are comparable move for move.
    expect(fromText).toEqual(fromTree);
  });
});

/**
 * Evaluations are read only by the replayed path — the static form prints the
 * score, not a number per move. Asserted here rather than in `tree.test.ts`
 * because the risk is that stripping and *reading* drift apart: a tag can be
 * removed from the prose correctly and still never reach the node.
 */
describe('evaluations survive the replay', () => {
  it('carries the stored evaluation onto each move', () => {
    const evaluations = mainline(pgnToTree(PGN)).map((node) => node.evaluation);
    expect(evaluations).toEqual(['0.15', '0.15', '-0.02', '0.54', '0.56', '0.51', undefined]);
  });

  // Sidelines commonly carry no evaluations in a game whose main line does, so
  // "this game has evals" is not a property with a single answer.
  it('leaves a move with no evaluation undefined rather than inheriting one', () => {
    const [first, second] = mainline(pgnToTree('1. e4 { [%eval 0.3] } e5 { A reply. }'));
    expect(first.evaluation).toBe('0.3');
    expect(second.evaluation).toBeUndefined();
  });
});
