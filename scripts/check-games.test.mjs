/**
 * Run with `npm run test:scripts`.
 *
 * The chess island fails quietly by design, so every check here is about a
 * failure that would otherwise be *invisible*: a board a reader sees blank, a
 * `:move[…]` that has silently stopped being a button, or a pattern in the
 * checker itself that has stopped matching and reports a clean run over nothing.
 *
 * These spawn real processes because `BOOKS_DIR` is resolved when
 * `book-sources.mjs` is first imported, so it cannot be re-pointed in-process.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './book-sources.mjs';

let workspace;
let booksDir;

const DESCRIPTOR = {
  schemaVersion: 2,
  authorId: 'example.com',
  slug: 'games',
  title: 'Games',
  visibility: 'private',
  islands: { packs: { chess: {} } },
};

/** Writes a one-chapter book and returns the checker's result. */
function check(markdown, descriptor = DESCRIPTOR) {
  const folder = join(booksDir, descriptor.slug);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(join(folder, 'content'), { recursive: true });
  writeFileSync(join(folder, 'smartbook.json'), JSON.stringify(descriptor, null, 2));
  writeFileSync(join(folder, 'content', '01-chapter.md'), markdown);

  try {
    return {
      code: 0,
      output: execFileSync(process.execPath, [join(ROOT, 'scripts', 'check-games.mjs')], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
      }),
    };
  } catch (error) {
    return { code: error.status, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

const SCHOLARS = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#';

describe('check-games', () => {
  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-games-'));
    booksDir = join(workspace, 'books');
    mkdirSync(booksDir, { recursive: true });
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  test('a legal game replays', () => {
    const result = check(
      `# One\n\n:::chess-board{id="a"}\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\n:::\n`,
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /1 game\(s\) replay cleanly/);
  });

  test('an illegal move is reported with its line', () => {
    const result = check(
      `# One\n\n:::chess-board{id="a"}\n\n\`\`\`pgn\n1. e4 e5 2. Qxf7#\n\`\`\`\n\n:::\n`,
    );
    assert.equal(result.code, 1);
    assert.match(result.output, /01-chapter\.md:3: error a: illegal move "Qxf7#"/);
  });

  // The failure mode that looks like success: the island renders a board that
  // is stuck at the starting position, and nothing else in the build notices.
  test('a game with no playable move is reported', () => {
    const result = check(
      '# One\n\n:::chess-board{id="a"}\n\n```pgn\n{Just a note.} *\n```\n\n:::\n',
    );
    assert.equal(result.code, 1);
    assert.match(result.output, /parsed, but no move is playable/);
  });

  test('a move mark naming nothing is reported', () => {
    const body = `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\nThen :move[9. Rd8].\n\n:::\n`;
    const result = check(body);
    assert.equal(result.code, 1);
    assert.match(result.output, /:move\[9\. Rd8\] names no move in the game/);
  });

  // Regression: the charter allows `Bc4`, `2. Bc4` and `2.Bc4` for one move,
  // and sidelines are reachable by writing the number. An earlier version of
  // this checker demanded a move number and rejected every bare SAN.
  test('every form of a label the island accepts resolves', () => {
    const pgn = `${SCHOLARS.replace('3. Qh5 Nf6', '3. Qh5 Nf6 (3... g6 4. Qf3 Nf6)')}`;
    const marks = ':move[e5] :move[2. Bc4] :move[2.Bc4] :move[4. Qxf7#] :move[3... g6]';
    const result = check(
      `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${pgn}\n\`\`\`\n\n${marks}\n\n:::\n`,
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /5 move mark\(s\) resolve/);
  });

  // Reformatting once moved a fence away from its directive line, and the
  // checker reported a clean run over zero games. Counting the islands that
  // *ought* to hold a game inline is what makes that visible.
  test('an island whose game the pattern can no longer see is reported', () => {
    const result = check(
      `# One\n\n:::chess-board{id="a"}\n\nA note first.\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\n:::\n`,
    );
    assert.equal(result.code, 1);
    assert.match(result.output, /1 chess island\(s\) should hold a game inline, but 0 matched/);
  });

  // A board reading `pgn="assets/…"` has its game in a file, so having no
  // fenced body is correct and must not trip the guard above.
  test('a board whose game is in a file is not counted as missing', () => {
    const result = check('# One\n\n::chess-board{id="a" pgn="assets/game.pgn"}\n');
    assert.equal(result.code, 0, result.output);
  });

  test('a book that does not declare the chess pack is skipped', () => {
    const plain = { ...DESCRIPTOR, slug: 'plain', islands: undefined };
    const result = check('# One\n\n:::chess-board{id="a"}\n\n```pgn\n1. e9\n```\n\n:::\n', plain);
    assert.equal(result.code, 0, result.output);
  });
});
