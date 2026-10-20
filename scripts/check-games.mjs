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
 * It also resolves **everything inside a game that names a part of it**, which
 * is three things rather than the one this started as:
 *
 * - `:move[…]` — a label naming no move renders as plain text rather than a
 *   button: a sentence that has quietly stopped working. **Error.**
 * - `::chess-board{at="…"}` — the same label vocabulary. A pin that resolves to
 *   nothing does not fail; it silently becomes a *live* board that follows the
 *   reader, so the diagram the author placed wanders off. **Error.**
 * - Either label matching several sidelines and no main-line move keeps its
 *   first-match behaviour, but names the competing lines. **Warning.**
 * - `::chess-diagram{fen="…"}` — a diagram whose position the game reaches is a
 *   tap target, and one it does not reach is a plain figure. **Both are legal**
 *   (a book may print a position from anywhere), so this is a **warning**: a
 *   one-character slip in 69 characters of FEN downgrades the diagram and
 *   nothing else would say so.
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
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import { BOOKS_DIR, listBookFolders, listContentFiles, readDescriptor } from './book-sources.mjs';
import {
  labelTargetsOf,
  normalise,
  positionKey,
  positionsOf,
  resolveLabelReference,
} from './chess-labels.mjs';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const textOf = (node) => node.value ?? (node.children ?? []).map(textOf).join('');

/**
 * A chess island holding its game inline, as `[id, pgn, index]`.
 *
 * `\s*` between the directive and its fence: a container directive's body is
 * block content, so a formatter is free to put a blank line before the fence.
 */
const WITH_PGN = /:::chess-(?:board|game)\{id="([^"]+)"[^}]*\}\s*```pgn\r?\n([\s\S]*?)\r?\n```/dg;

/** Any `[%name value]` tag, so `[%evaluation 5]` is not read as an evaluation. */
const EVAL_TAG = /\[%(\w+)([^\]]*)\]/dg;

/** What the reader's parser accepts: `0.54`, `-1.3`, `#5`, `#-3`. */
const EVAL_VALUE = /^(?:#-?\d+|[+-]?\d+\.\d+|[+-]?\d+)$/;

/**
 * `[%eval]` tags the island will drop, with their offset inside the PGN.
 *
 * Dropped silently at runtime, like an unknown arrow colour — so the author
 * states an evaluation, sees no error, and the book shows nothing.
 */
function badEvaluations(pgn) {
  const found = [];
  for (const match of pgn.matchAll(EVAL_TAG)) {
    if (match[1].toLowerCase() !== 'eval') continue;
    const value = match[2].trim();
    if (EVAL_VALUE.test(value)) continue;
    found.push({ value, index: match.indices[0][0] });
  }
  return found;
}

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
 * Every `:::chess-game` container and the three kinds of reference in its body.
 *
 * The `d` flag is what makes the line numbers exact: `match.indices[3]` gives
 * the body's absolute offset, so each reference is located by its own position
 * rather than by searching the block for its text — which reports every
 * repetition of a mark at the line of the first one.
 *
 * Parse body directives like the reader: table cells, quoted/encoded attributes,
 * aliases and references inside code must not acquire different meanings here.
 */
function gamesIn(markdown) {
  const pattern =
    /:::chess-game\{id="([^"]+)"[^}]*\}\s*```pgn\r?\n([\s\S]*?)\r?\n```([\s\S]*?)\r?\n:::/dg;

  return [...markdown.matchAll(pattern)].map((match) => {
    const body = match[3];
    const bodyStart = match.indices[3][0];
    const moves = [];
    const pins = [];
    const diagrams = [];
    visit(parser.parse(body), (node) => {
      const attributes = node.attributes ?? {};
      const sourceLine = lineAt(markdown, bodyStart + (node.position?.start.offset ?? 0));
      if (node.type === 'textDirective' && node.name === 'move') {
        moves.push({ label: textOf(node), line: sourceLine, selector: attributes.line });
      }
      if (node.type !== 'leafDirective') return;
      if (
        /^chess-?board$/.test(node.name) &&
        (attributes.at !== undefined || attributes.line !== undefined)
      ) {
        pins.push({ label: attributes.at ?? '', line: sourceLine, selector: attributes.line });
      }
      if (/^chess-?diagram$/.test(node.name) && attributes.fen) {
        diagrams.push({ fen: attributes.fen, line: sourceLine });
      }
    });

    return {
      id: match[1],
      pgn: match[2],
      moves,
      pins,
      diagrams,
    };
  });
}

function warnIfAmbiguous(targets, where, id, reference) {
  if (targets.length < 2 || targets.some((target) => target.mainline)) return;

  const describe = (target) => JSON.stringify(target.line.join(' '));
  console.warn(
    `${where}: warning move-ambiguous: ${reference} matches ${targets.length} sideline moves ` +
      `in "${id}"; it resolves to the first: ${describe(targets[0])}. ` +
      `Other matches: ${targets.slice(1).map(describe).join('; ')}. ` +
      `Use a move number if it disambiguates, or add line=${describe(targets[0])} ` +
      `and extend it until it identifies one route.`,
  );
}

function checkExplicitLine(known, label, selector, where, id, reference) {
  const result = resolveLabelReference(known, label, selector);
  if (result.status === 'resolved') return true;
  const reason = {
    invalid: 'start with a move number and use contiguous SAN moves with consistent numbering',
    missing: 'this sequence does not occur in the game; check its moves and numbering',
    ambiguous:
      'this sequence occurs on multiple routes; add earlier or later moves to distinguish them',
    target:
      'the label must name exactly one move within the supplied line; include it and number the label',
  }[result.status];
  console.error(
    `${where}: error move-line-${result.status}: ${reference} with line=${JSON.stringify(selector)} ` +
      `in "${id}" does not select one move: ${reason}.`,
  );
  return false;
}

const wanted = process.argv.slice(2);
const folders = listBookFolders().filter((name) => wanted.length === 0 || wanted.includes(name));

let games = 0;
let marks = 0;
let shown = 0;
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

        // A warning rather than an error: an evaluation is an annotation, not a
        // sentence that has stopped working, and exporters write forms nobody
        // here has seen. Silent at runtime either way, which is the point.
        const pgnStart = match.indices[2][0];
        for (const { value, index } of badEvaluations(pgn)) {
          console.warn(
            `${where}:${lineAt(markdown, pgnStart + index)}: warning ${id}: ` +
              `[%eval ${value}] is not an evaluation, so it will not be shown. ` +
              `Write a number like 0.54 or -1.3, or a mate like #5.`,
          );
        }
      } catch (error) {
        failed++;
        console.error(`${where}:${line}: error ${id}: ${error.message}`);
      }
    }

    for (const { id, pgn, moves: found, pins, diagrams } of gamesIn(markdown)) {
      const known = labelTargetsOf(pgn);

      for (const { label, line, selector } of found) {
        marks++;
        if (selector !== undefined) {
          if (!checkExplicitLine(known, label, selector, `${where}:${line}`, id, `:move[${label}]`))
            failed++;
          continue;
        }
        const targets = known.get(normalise(label));
        if (targets) {
          warnIfAmbiguous(targets, `${where}:${line}`, id, `:move[${label}]`);
          continue;
        }
        failed++;
        console.error(`${where}:${line}: error ${id}: :move[${label}] names no move in the game.`);
      }

      // A pin that resolves to nothing does not render an error, it renders a
      // *different board*: one that follows the reader instead of holding the
      // position the author placed it for.
      for (const { label, line, selector } of pins) {
        marks++;
        if (selector !== undefined) {
          if (!checkExplicitLine(known, label, selector, `${where}:${line}`, id, `at="${label}"`))
            failed++;
          continue;
        }
        const targets = known.get(normalise(label));
        if (targets) {
          warnIfAmbiguous(targets, `${where}:${line}`, id, `at="${label}"`);
          continue;
        }
        failed++;
        console.error(
          `${where}:${line}: error ${id}: at="${label}" names no move in the game, ` +
            `so this board will follow the reader instead of staying put.`,
        );
      }

      // Legal either way, so a warning: the author may be printing a position
      // from somewhere else on purpose.
      if (diagrams.length > 0) {
        const positions = positionsOf(pgn);
        for (const { fen, line } of diagrams) {
          shown++;
          if (positions.has(positionKey(fen))) continue;
          console.warn(
            `${where}:${line}: warning ${id}: this diagram's position does not occur ` +
              `in the game, so tapping it will do nothing. Intended?`,
          );
        }
      }
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} problem(s) in ${games} game(s).`);
  process.exit(1);
}

console.log(
  `${games} game(s) replay cleanly, ${marks} reference(s) resolve, ` +
    `and ${shown} diagram(s) in a game were checked.`,
);
