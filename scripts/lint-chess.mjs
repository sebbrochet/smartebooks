/**
 * Asks whether a game's annotations will ever be seen, as part of
 * `lint:content`.
 *
 * A `:::chess-game` shows a comment in exactly one place: the score, which the
 * author places themselves with `::chess-moves`. Leave that out and every
 * annotation in the PGN is parsed, stripped of its shape tokens, attached to a
 * node — and rendered nowhere. The board shows the move's *name*, never its
 * comment.
 *
 * Found 2026-09-26 in a repertoire book whose author removed `::chess-moves`
 * because the annotations duplicated the prose. That was the right editorial
 * call and it left fifteen comments in the source that no reader could reach,
 * with nothing to say so.
 *
 * **Nothing here re-implements the pack.** `pgnToTree` is the reader's own
 * parser, so "is there a comment here" is answered once — and answered after
 * `[%cal …]` tokens have been taken out, which matters: a comment holding only
 * a shape still draws on the board and is not lost.
 */
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS_DIR, listContentFiles, readDescriptor } from './book-sources.mjs';

register('./ts-hooks.mjs', import.meta.url);

const { pgnToTree } = await import('../packages/islands-chess/src/tree.ts');

/** Alias spellings render, so they have to be checked too. */
const OPENER = /^:::(chess-?game)\{([^}]*)\}\s*$/;
const SCORE = /^::(chess-?moves)\b/;

/** Every `:::chess-game` in a file, with its body. */
function gamesIn(markdown) {
  const lines = markdown.split('\n');
  const games = [];

  for (let index = 0; index < lines.length; index++) {
    if (!OPENER.test(lines[index])) continue;

    const body = [];
    let fence = null;
    let pgn = '';
    let end = lines.length;

    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      const ticks = /^\s*(`{3,})\s*(\S*)/.exec(line);

      if (fence === null && ticks) {
        fence = { marker: ticks[1], language: ticks[2], from: cursor };
        continue;
      }
      if (fence !== null) {
        if (ticks && ticks[1].startsWith(fence.marker) && !ticks[2]) {
          if (fence.language === 'pgn') pgn = lines.slice(fence.from + 1, cursor).join('\n');
          fence = null;
        }
        continue;
      }
      if (line.trim() === ':::') {
        end = cursor;
        break;
      }
      body.push(line);
    }

    games.push({ line: index + 1, pgn, hasScore: body.some((line) => SCORE.test(line.trim())) });
    index = end;
  }

  return games;
}

/** Annotations a reader could lose, shapes already removed by the parser. */
function annotations(pgn) {
  let tree;
  try {
    tree = pgnToTree(pgn);
  } catch {
    return 0;
  }

  let found = tree.comment ? 1 : 0;
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.comment) found++;
      if (node.startingComment) found++;
      walk(node.children);
    }
  };
  walk(tree.children);
  return found;
}

export function checkChess(folder) {
  const descriptor = readDescriptor(folder);
  if (!descriptor?.islands?.packs?.chess) return [];

  const problems = [];

  for (const file of listContentFiles(folder)) {
    const markdown = readFileSync(join(BOOKS_DIR, folder, file), 'utf8');

    for (const { line, pgn, hasScore } of gamesIn(markdown)) {
      if (hasScore || !pgn) continue;
      const hidden = annotations(pgn);
      if (hidden === 0) continue;

      problems.push({
        folder,
        file,
        line,
        rule: 'chess-comment-hidden',
        severity: 'warning',
        message:
          `${hidden} annotation(s) in this game will never be shown: a chess-game prints comments ` +
          `only through ::chess-moves, and this one has none. Add the score, or take the ` +
          `annotations out of the PGN — a comment holding just a [%cal …] still draws.`,
      });
    }
  }

  return problems;
}
