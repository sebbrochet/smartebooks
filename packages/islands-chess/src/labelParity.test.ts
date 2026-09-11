// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { pgnToTree } from './tree';
import { findByLabel, findByFen, positionKey } from './score';
import {
  labelsOf,
  normalise,
  positionKey as scriptPositionKey,
  positionsOf,
} from '../../../scripts/chess-labels.mjs';

/**
 * The reader and the checker must agree about what a directive names.
 *
 * `score.ts` decides at read time whether `:move[2. Bc4]` is a button and
 * whether a diagram's FEN is a tap target. `scripts/chess-labels.mjs` decides
 * at build time whether the same thing is an error. They are two
 * implementations of one rule, duplicated because the scripts are plain `.mjs`
 * and cannot load the engine's TypeScript — and **nothing compared them**.
 *
 * That is the shape SPEC008 §4.19 named: a fact written twice, a suite that
 * exercises one copy, and no join. `check-games.test.mjs` tests the script and
 * `score.test.ts` tests the engine, and both would stay green through a change
 * that made them disagree. The failure is quiet in the worst way: the checker
 * would keep validating a book against rules the reader no longer uses, so a
 * green build would mean nothing.
 *
 * So this asserts the two **answers**, not the two implementations: for every
 * label, does the reader resolve it exactly when the checker accepts it?
 */
const SCHOLARS = `1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? {Developing, and losing.}
(3... g6 {The move.} 4. Qf3 Nf6)
4. Qxf7# {Scholar's mate.}`;

/** A game that does not start from the initial array, for the `tree.fen` path. */
const FROM_FEN = `[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]

1. e4 Kd7 2. e5 Kc6`;

describe('the reader and the checker agree about labels', () => {
  const tree = pgnToTree(SCHOLARS);
  const known = labelsOf(SCHOLARS);

  /*
   * Every spelling the charter allows, plus the ones it does not. The negative
   * cases matter more than the positive ones here: two implementations tend to
   * agree about the obvious input and drift on the edges.
   */
  const labels = [
    // The same move, written every way an author might write it.
    '2. Bc4',
    '2.Bc4',
    'Bc4',
    '2. bc4',
    '2. Bc4!',
    '2. Bc4?!',
    ' 2. Bc4 ',
    // Annotated in the source, named plainly in the prose.
    '3. Qh5',
    'Nf6',
    '3... Nf6',
    '4. Qxf7#',
    '4. Qxf7',
    // A sideline, which is reachable by number.
    '3... g6',
    '3...g6',
    'g6',
    // Nothing at all.
    '9. Rd8',
    'Qh7',
    '2... Bc4',
    '',
    'e4 e5',
    // Numbers that exist attached to moves that do not.
    '1. Bc4',
    '4. Qxf8#',
  ];

  it.each(labels)('resolve %j the same way', (label) => {
    const reader = findByLabel(tree, label) !== undefined;
    const checker = known.has(normalise(label));
    expect(checker, `reader ${reader}, checker ${checker}`).toBe(reader);
  });
});

describe('the reader and the checker agree about positions', () => {
  const tree = pgnToTree(SCHOLARS);
  const reached = positionsOf(SCHOLARS);

  const fens = [
    // The start, which `findByFen` checks before it walks anything.
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    // After 3…Nf6, and the same position with the clocks written differently.
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
    // A position from the sideline.
    'r1bqkbnr/pppp1p1p/2n3p1/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
    // Right pieces, wrong side to move — a different position.
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 4 4',
    // Somewhere else entirely, and some things that are not positions.
    '8/8/8/8/8/8/8/K6k w - - 0 1',
    '',
    'not a fen',
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR',
  ];

  it.each(fens)('resolve %j the same way', (fen) => {
    const reader = findByFen(tree, fen) !== undefined;
    const checker = reached.has(scriptPositionKey(fen));
    expect(checker, `reader ${reader}, checker ${checker}`).toBe(reader);
  });

  it.each(fens)('key %j identically', (fen) => {
    expect(scriptPositionKey(fen)).toBe(positionKey(fen));
  });

  // A game with a `[FEN]` header starts somewhere the initial array is not, and
  // both sides have to take their root from the header rather than assume one.
  it('agrees about a game that does not start from the initial array', () => {
    const custom = pgnToTree(FROM_FEN);
    const customReached = positionsOf(FROM_FEN);

    for (const fen of [
      '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ]) {
      expect(customReached.has(scriptPositionKey(fen)), fen).toBe(
        findByFen(custom, fen) !== undefined,
      );
    }
  });
});
