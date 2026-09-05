/**
 * Replays every chess island holding a PGN and reports any game a reader would
 * see as a blank board.
 *
 * The chess island fails *quietly* by design — a book that ships one malformed
 * PGN should still render the rest — so an import that mangled a game looks
 * fine in a diff and stays invisible until someone opens that chapter. This
 * replays each game the way `tree.ts` does, through the same `chessops` the
 * reader runs, and counts the plies.
 *
 * It also resolves every `:move[…]` mark. A mark whose label names no move in
 * its game renders as plain text rather than a button: no error, no warning,
 * just a sentence that has quietly stopped working.
 *
 * Honours SMART_EBOOKS_BOOKS_DIR, so a book kept in a separate repository is
 * checked without being copied into this one.
 *
 *   node scripts/check-games.mjs [slug…]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import { BOOKS_DIR, listBookFolders, listContentFiles, readDescriptor } from './book-sources.mjs';

/**
 * A chess island holding its game inline, as `[id, pgn, index]`.
 *
 * `\s*` between the directive and its fence: a container directive's body is
 * block content, so a formatter is free to put a blank line before the fence.
 */
const WITH_PGN = /:::chess-(?:board|game)\{id="([^"]+)"[^}]*\}\s*```pgn\r?\n([\s\S]*?)\r?\n```/g;

/**
 * Every chess island that *ought* to hold a game inline.
 *
 * Counted separately so that a `WITH_PGN` which has stopped matching is caught
 * rather than reported as a clean run over zero games — the exact failure that
 * looks most like success. Islands carrying `pgn="assets/…"` are excluded:
 * their game is in a file, so having no fenced body is correct.
 */
const INLINE_EXPECTED = /^:::chess-(?:board|game)\{(?![^}]*\bpgn=)[^}]*\}/gm;

/** Line number of a character offset, for an error a reader can navigate to. */
function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * Number of mainline plies the island would be able to replay.
 *
 * Every child is played, not only the first: a variation is a line the reader
 * can click into, so an illegal move in one is as visible as an illegal move in
 * the game itself. Only the mainline is counted, because that is what a
 * `PlyCount` header claims.
 */
function plies(pgn) {
  const game = parsePgn(pgn)[0];
  if (!game) throw new Error('no game in PGN');

  const walk = (node, position, depth) => {
    let mainline = depth;
    for (const [index, child] of node.children.entries()) {
      const move = parseSan(position, child.data.san);
      if (!move) throw new Error(`illegal move "${child.data.san}" at ply ${depth + 1}`);
      const next = position.clone();
      next.play(move);
      const reached = walk(child, next, depth + 1);
      if (index === 0) mainline = reached;
    }
    return mainline;
  };

  return walk(game.moves, startingPosition(game.headers).unwrap(), 0);
}

/**
 * Compare labels the way `score.ts` does: no spaces, no glyphs, no case.
 *
 * Dots are kept: `1.` and `1...` are White's and Black's move one, and
 * collapsing them would make two different moves compare equal.
 */
function normalise(label) {
  return label.replace(/[+#!?\s]+/g, '').toLowerCase();
}

/**
 * Every form of every move a `:move[…]` could name.
 *
 * Mirrors `findByLabel` in `packages/islands-chess/src/score.ts`, which matches
 * either `"<number> <san>"` or the bare SAN — so `2. Bc4`, `2.Bc4` and `Bc4`
 * all name the same move. Duplicated rather than imported for the reason the
 * island contract is duplicated: these scripts cannot load the engine's
 * TypeScript. If the two ever disagree, this reports a mark as broken that the
 * reader can click, which is the safe direction to be wrong in.
 */
function labelsOf(pgn) {
  const game = parsePgn(pgn)[0];
  const found = new Set();
  if (!game) return found;

  const walk = (node, position) => {
    for (const child of node.children) {
      const move = parseSan(position, child.data.san);
      if (!move) continue; // Reported by `plies`, which replays the same tree.
      const after = position.clone();

      // Read the number *before* playing, as `tree.ts` does: that is whose move it is.
      const number = after.turn === 'white' ? `${after.fullmoves}.` : `${after.fullmoves}...`;
      after.play(move);

      found.add(normalise(`${number} ${child.data.san}`));
      found.add(normalise(child.data.san));

      walk(child, after);
    }
  };

  walk(game.moves, startingPosition(game.headers).unwrap());
  return found;
}

/** Every `:::chess-game` container, as `[id, pgn, marks]`. */
function gamesIn(markdown) {
  const pattern =
    /:::chess-game\{id="([^"]+)"[^}]*\}\s*```pgn\r?\n([\s\S]*?)\r?\n```([\s\S]*?)\r?\n:::/g;
  return [...markdown.matchAll(pattern)].map((match) => [
    match[1],
    match[2],
    [...match[3].matchAll(/:move\[([^\]]+)\]/g)].map((mark) => ({
      label: mark[1],
      line: lineAt(markdown, match.index + match[0].indexOf(mark[0])),
    })),
  ]);
}

const wanted = process.argv.slice(2);
const folders = listBookFolders().filter((name) => wanted.length === 0 || wanted.includes(name));

let games = 0;
let marks = 0;
let failed = 0;

for (const folder of folders) {
  // Only books that declare the pack can hold a chess island at all.
  if (!readDescriptor(folder)?.islands?.packs?.chess) continue;

  for (const file of listContentFiles(folder)) {
    const where = `books/${folder}/${file}`;
    const markdown = readFileSync(join(BOOKS_DIR, folder, file), 'utf8');

    const found = [...markdown.matchAll(WITH_PGN)];
    const expected = [...markdown.matchAll(INLINE_EXPECTED)];
    if (found.length !== expected.length) {
      failed++;
      console.error(
        `${where}: ${expected.length} chess island(s) should hold a game inline, ` +
          `but ${found.length} matched. The pattern in WITH_PGN no longer fits the content.`,
      );
    }

    for (const match of found) {
      const [, id, pgn] = match;
      const line = lineAt(markdown, match.index);
      games++;
      try {
        const count = plies(pgn);
        // A game that parses but plays nothing is the failure mode that looks
        // like success: the island renders a board stuck at the start.
        if (count === 0) throw new Error('parsed, but no move is playable');

        const declared = Number(/\[PlyCount "(\d+)"\]/.exec(pgn)?.[1]);
        if (Number.isFinite(declared) && declared !== count) {
          console.warn(
            `${where}:${line}: warning ${id}: replayed ${count} plies, PGN declares ${declared}.`,
          );
        }
      } catch (error) {
        failed++;
        console.error(`${where}:${line}: error ${id}: ${error.message}`);
      }
    }

    for (const [id, pgn, found] of gamesIn(markdown)) {
      const known = labelsOf(pgn);
      for (const { label, line } of found) {
        marks++;
        if (known.has(normalise(label))) continue;
        failed++;
        console.error(`${where}:${line}: error ${id}: :move[${label}] names no move in the game.`);
      }
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} problem(s) in ${games} game(s).`);
  process.exit(1);
}

console.log(`${games} game(s) replay cleanly, and ${marks} move mark(s) resolve.`);
