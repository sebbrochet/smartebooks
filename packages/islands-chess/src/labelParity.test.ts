// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { allNodes, mainline, nodeAt, pgnToTree } from './tree';
import { findByLabel, findByFen, positionKey, resolveMoveReference } from './score';
import {
  labelsOf,
  labelTargetsOf,
  normalise,
  positionKey as scriptPositionKey,
  positionsOf,
  resolveLabelReference,
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
  const targets = labelTargetsOf(SCHOLARS);

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
    const target = targets.get(normalise(label))?.[0];
    const path = findByLabel(tree, label);
    expect(target?.path).toBe(path);
    if (path !== undefined) expect(target?.fen).toBe(nodeAt(tree, path)?.fen);
  });
});

describe('the reader and checker select the same explicit route', () => {
  const pgn =
    '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 ' +
    '(4... Nd7) (4... Nf6 5. Nxf6+ gxf6 (5... exf6))';
  const tree = pgnToTree(pgn);
  const targets = labelTargetsOf(pgn);

  it.each([
    ['4... Nf6', '4... Nf6 5. Nxf6+ gxf6', 'resolved'],
    ['4... Nf6', '4... Nf6 5. Nxf6+ exf6', 'resolved'],
    ['5... exf6', '4...Nf6 5.Nxf6+ exf6', 'resolved'],
    ['5... exf6', '4... Nf6', 'target'],
    ['4... Nf6', '4... Nf6 6. Nxf6+', 'invalid'],
    ['4... Nf6', '', 'invalid'],
    ['4... Nf6', '4... Nd7 5. Nxf6+', 'missing'],
  ])('%s on %s gives %s', (label, line, status) => {
    const reader = resolveMoveReference(allNodes(tree), label, line);
    const checker = resolveLabelReference(targets, label, line);
    expect(reader.status).toBe(status);
    expect(checker).toEqual(reader);
    if (reader.status === 'resolved') {
      const end = nodeAt(tree, reader.line ?? '');
      expect(end?.san).toBe(line.endsWith('exf6') ? 'exf6' : 'gxf6');
      expect(nodeAt(tree, reader.path)?.san).toBe(label.includes('exf6') ? 'exf6' : 'Nf6');
    }
  });

  it('agrees about a custom starting position and its move numbers', () => {
    const pgn =
      '[FEN "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]\n\n' +
      '3... a6 (3... Nf6) 4. Ba4';
    const tree = pgnToTree(pgn);
    const reader = resolveMoveReference(allNodes(tree), '3... a6', '3... a6 4.Ba4');
    expect(reader).toEqual({ status: 'resolved', path: '0', line: '0.0' });
    expect(resolveLabelReference(labelTargetsOf(pgn), '3... a6', '3... a6 4.Ba4')).toEqual(reader);
  });
});

const AMBIGUOUS = `1. e4 c6 2. Nf3 d5
3. exd5 (3. e5 Bg4 4. d4 e6)
(3. Nc3 Bg4)
3... cxd5 4. d4`;

describe('the checker identifies the actual target, not just a resolving label', () => {
  it.each([
    ['sibling sidelines', AMBIGUOUS],
    [
      'earlier divergence with identical immediate predecessors',
      `1. e4 c6 2. Nf3 d5
3. exd5 (3. e5 Bg4 4. Nc3 e6 5. d4)
(3. Nc3 Bg4 4. e5 e6 5. d4)
3... cxd5 4. d4`,
    ],
    ['skipped illegal siblings', '1. e4 e5 (1... Ke7) (1... c5) 2. Nf3'],
    [
      'a custom starting position and Black move number',
      `[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 23"]

23... Kd7 (23... Kf7) 24. e4 Kc6`,
    ],
  ])('matches paths, positions and mainline membership for %s', (_name, pgn) => {
    const tree = pgnToTree(pgn);
    const nodes = allNodes(tree);
    const principal = new Set(mainline(tree).map((node) => node.path));
    const targets = labelTargetsOf(pgn);
    expect(nodes.length).toBeGreaterThan(0);
    expect(targets.size).toBeGreaterThan(0);

    for (const [label, candidates] of targets) {
      expect(candidates[0].path, label).toBe(findByLabel(tree, label));
      expect(candidates.map((target) => target.path)).toEqual(
        nodes
          .filter(
            (node) =>
              normalise(`${node.number} ${node.san}`) === label || normalise(node.san) === label,
          )
          .map((node) => node.path),
      );
      for (const target of candidates) {
        const node = nodeAt(tree, target.path);
        expect(node, `${label} at ${target.path}`).toBeDefined();
        expect(target.fen).toBe(node?.fen);
        expect(target.mainline).toBe(principal.has(target.path));
        expect(target.line[target.line.length - 1]).toBe(`${node?.number} ${node?.san}`);
      }
    }

    for (const node of nodes) {
      const candidates = targets.get(normalise(`${node.number} ${node.san}`));
      expect(
        candidates?.some((target) => target.path === node.path),
        node.path,
      ).toBe(true);
    }
  });

  it('keeps both sideline candidates while identifying the first selected position', () => {
    const tree = pgnToTree(AMBIGUOUS);
    const candidates = labelTargetsOf(AMBIGUOUS).get(normalise('3... Bg4'));
    expect(candidates?.map(({ path, mainline }) => ({ path, mainline }))).toEqual([
      { path: '0.0.0.0.1.0', mainline: false },
      { path: '0.0.0.0.2.0', mainline: false },
    ]);
    expect(candidates?.[0].path).toBe(findByLabel(tree, '3... Bg4'));
    expect(candidates?.[0].fen).not.toBe(candidates?.[1].fen);
    expect(candidates?.map((target) => target.line[target.line.length - 2])).toEqual([
      '3. e5',
      '3. Nc3',
    ]);
  });

  it('retains the mainline tie-break and the alternative behind it', () => {
    const tree = pgnToTree(AMBIGUOUS);
    const candidates = labelTargetsOf(AMBIGUOUS).get(normalise('4. d4'));
    expect(candidates?.map((target) => target.mainline)).toEqual([true, false]);
    expect(candidates?.[0].path).toBe(findByLabel(tree, '4. d4'));
    expect(candidates?.[0].path).toBe('0.0.0.0.0.0.0');
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
