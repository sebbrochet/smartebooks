import { describe, it, expect } from 'vitest';
import { allNodes, mainline, mainlinePath, nodeAt, parentPath, pgnToTree } from './tree';

describe('pgnToTree', () => {
  it('reads a mainline into a chain of positions', () => {
    const tree = pgnToTree('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#');
    expect(mainline(tree).map((node) => node.san)).toEqual([
      'e4',
      'e5',
      'Bc4',
      'Nc6',
      'Qh5',
      'Nf6',
      'Qxf7#',
    ]);
    expect(tree.fen).toContain('rnbqkbnr/pppppppp'); // standard start
    expect(mainline(tree)[0].fen).not.toBe(tree.fen);
  });

  it('numbers moves, not plies', () => {
    const line = mainline(pgnToTree('1. e4 e5 2. Bc4 Nc6'));
    expect(line.map((node) => node.number)).toEqual(['1.', '1...', '2.', '2...']);
  });

  it('takes the number from the position, so a FEN start is right', () => {
    // Black to move on move 3 — a ply counter would call this move one.
    const pgn =
      '[FEN "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]\n\n3... a6 4. Ba4';
    expect(mainline(pgnToTree(pgn)).map((node) => node.number)).toEqual(['3...', '4.']);
  });

  it('has nothing to show for junk input', () => {
    const tree = pgnToTree('not a pgn at all ~~~');
    expect(tree.children).toEqual([]);
    expect(mainline(tree)).toEqual([]);
  });
});

/**
 * SPEC008 C5: annotated chess is written with sidelines, and a flat list of
 * positions dropped every one of them in silence.
 */
describe('variations', () => {
  const tree = pgnToTree('1. e4 e5 (1... d5 2. exd5 (2. Nc3 dxe4) 2... Qxd5) 2. Nf3');

  it('keeps the mainline as the first child at every step', () => {
    expect(mainline(tree).map((node) => node.san)).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('keeps a sideline as a sibling of the move it replaces', () => {
    const afterE4 = tree.children[0];
    expect(afterE4.children.map((node) => node.san)).toEqual(['e5', 'd5']);
  });

  it('replays a sideline from the position before its parent move, not after', () => {
    // 1... d5 is Black's alternative to 1... e5, so it is played from the
    // position after 1. e4 — the same one e5 was played from.
    const [e5, d5] = tree.children[0].children;
    expect(e5.number).toBe('1...');
    expect(d5.number).toBe('1...');
    expect(d5.children[0].san).toBe('exd5');
  });

  it('nests a sideline inside a sideline', () => {
    const d5 = tree.children[0].children[1];
    const exd5 = d5.children[0];
    expect(d5.children.map((node) => node.san)).toEqual(['exd5', 'Nc3']);
    expect(exd5.children[0].san).toBe('Qxd5');
  });

  it('reads a note written to introduce a sideline', () => {
    const introduced = pgnToTree('1. e4 e5 ({Sharper is} 1... c5 2. Nf3) 2. Nf3');
    expect(introduced.children[0].children[1].startingComment).toBe('Sharper is');
  });

  it('keeps commentary and glyphs on the sideline they belong to', () => {
    const annotated = pgnToTree('1. e4 e5 (1... d5 $6 {The Scandinavian.} 2. exd5)');
    const d5 = annotated.children[0].children[1];
    expect(d5.nag).toBe('?!');
    expect(d5.comment).toBe('The Scandinavian.');
  });

  // An illegal sideline must cost the reader that line, not the page.
  it('drops a line it cannot replay and keeps the rest of the game', () => {
    const tree = pgnToTree('1. e4 e5 (1... Qh4 2. nonsense) 2. Nf3');
    expect(mainline(tree).map((node) => node.san)).toEqual(['e4', 'e5', 'Nf3']);
  });
});

describe('paths', () => {
  const tree = pgnToTree('1. e4 e5 (1... d5 2. exd5) 2. Nf3');

  it('names each position by its route from the start', () => {
    expect(mainline(tree).map((node) => node.path)).toEqual(['0', '0.0', '0.0.0']);
    expect(tree.children[0].children[1].path).toBe('0.1');
  });

  it('finds the node a path names, including inside a sideline', () => {
    expect(nodeAt(tree, '0.1')?.san).toBe('d5');
    expect(nodeAt(tree, '0.1.0')?.san).toBe('exd5');
  });

  // Whole-game order, main line before the branches off it, so a name written
  // in the prose resolves to the obvious move rather than to a variation.
  it('walks every node in the game, main line first', () => {
    expect(allNodes(tree).map((node) => node.san)).toEqual(['e4', 'e5', 'Nf3', 'd5', 'exd5']);
    expect(allNodes(pgnToTree('~~~'))).toEqual([]);
  });

  it('has no node for the starting position or a path that does not exist', () => {
    expect(nodeAt(tree, '')).toBeUndefined();
    expect(nodeAt(tree, '9')).toBeUndefined();
    expect(nodeAt(tree, '0.0.0.0')).toBeUndefined();
    expect(nodeAt(tree, 'nonsense')).toBeUndefined();
  });

  it('steps back to the position a move was played from', () => {
    expect(parentPath('0.1.0')).toBe('0.1');
    expect(parentPath('0')).toBe('');
  });

  // Readers have a ply number saved from before paths existed. It still names
  // the same move of the same game.
  it('migrates a saved ply to the path of the same mainline move', () => {
    expect(mainlinePath(tree, 1)).toBe('0');
    expect(mainlinePath(tree, 3)).toBe('0.0.0');
    expect(mainlinePath(tree, 0)).toBe('');
    // Past the end of a game that has since been shortened.
    expect(mainlinePath(tree, 99)).toBe('0.0.0');
    expect(mainlinePath(pgnToTree('~~~'), 4)).toBe('');
  });
});

/**
 * A PGN's `{…}` comments are the reason an annotated game is worth reading.
 */
describe('annotations', () => {
  it('keeps a comment against the position it describes', () => {
    const line = mainline(pgnToTree("1. e4 {King's pawn.} e5 2. Bc4 {The Bishop's Opening.}"));
    expect(line[0].comment).toBe("King's pawn.");
    expect(line[1].comment).toBeUndefined();
    expect(line[2].comment).toBe("The Bishop's Opening.");
  });

  it('puts a comment written before the first move on the starting position', () => {
    expect(pgnToTree('{A famous miniature.} 1. e4 e5').comment).toBe('A famous miniature.');
  });

  it('has no comment at the start when none was written', () => {
    expect(pgnToTree('1. e4 e5').comment).toBeUndefined();
  });

  it('renders NAGs the way chess writing spells them', () => {
    expect(mainline(pgnToTree('1. e4 $1 e5 $6 2. Bc4 $3')).map((n) => n.nag)).toEqual([
      '!',
      '?!',
      '!!',
    ]);
  });

  // `$47` on a board would be noise, not annotation.
  it('drops NAGs it has no symbol for', () => {
    expect(mainline(pgnToTree('1. e4 $47'))[0].nag).toBeUndefined();
  });

  it('joins consecutive comments on one move', () => {
    expect(mainline(pgnToTree('1. e4 {first} {second}'))[0].comment).toBe('first second');
  });

  it('ignores an empty comment rather than showing a blank note', () => {
    expect(mainline(pgnToTree('1. e4 {   }'))[0].comment).toBeUndefined();
  });
});

/**
 * Annotators draw on the board as well as writing about it. The tags live
 * inside the comment text, so keeping the shapes and keeping the prose
 * readable are the same problem.
 */
describe('board shapes', () => {
  it('lifts arrows out of a move comment and onto its position', () => {
    const line = mainline(pgnToTree('1. e4 e5 2. Bc4 {Eyeing f7. [%cal Gc4f7]}'));
    expect(line[2].shapes).toEqual([{ orig: 'c4', dest: 'f7', brush: 'green' }]);
  });

  it('removes the tag from the comment the reader is shown', () => {
    const line = mainline(pgnToTree('1. e4 e5 2. Bc4 {Eyeing f7. [%cal Gc4f7]}'));
    expect(line[2].comment).toBe('Eyeing f7.');
  });

  it('reads shapes written before the first move onto the starting position', () => {
    expect(pgnToTree('{[%csl Re4]} 1. e4').shapes).toEqual([{ orig: 'e4', brush: 'red' }]);
  });

  // A caller clears the board's shapes from this array, so a position with
  // none must still have one rather than a hole.
  it('gives every position an array', () => {
    const line = mainline(pgnToTree('1. e4 e5 2. Bc4 {[%cal Gc4f7]}'));
    expect(line[0].shapes).toEqual([]);
    expect(pgnToTree('1. e4').shapes).toEqual([]);
  });

  it('leaves a comment that is only a tag with no text at all', () => {
    expect(mainline(pgnToTree('1. e4 {[%cal Ge2e4]}'))[0].comment).toBeUndefined();
  });
});
