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
import { spawnSync } from 'node:child_process';
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

/**
 * Writes a one-chapter book and returns the checker's result.
 *
 * `spawnSync` rather than `execFileSync`: the latter returns **stdout only**,
 * and hands over stderr solely on a non-zero exit. Every warning this checker
 * emits therefore vanished on a clean run, so no warning it produces was
 * testable at all — including the `PlyCount` mismatch that predates this.
 */
function check(markdown, descriptor = DESCRIPTOR) {
  const folder = join(booksDir, descriptor.slug);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(join(folder, 'content'), { recursive: true });
  writeFileSync(join(folder, 'smartbook.json'), JSON.stringify(descriptor, null, 2));
  writeFileSync(join(folder, 'content', '01-chapter.md'), markdown);

  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'check-games.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
  });

  return { code: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

const SCHOLARS = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#';

const AMBIGUOUS = [
  '1. e4 c6 2. Nf3 d5',
  '3. exd5 (3. e5 Bg4 4. d4 e6)',
  '(3. Nc3 Bg4)',
  '3... cxd5 4. d4',
].join('\n');

function gameBook(body, pgn = AMBIGUOUS) {
  return `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${pgn}\n\`\`\`\n\n${body}\n\n:::\n`;
}

/** The position after 3…Nf6 in {@link SCHOLARS}, which the game does reach. */
const AFTER_NF6 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

/** One game with one diagram in it. */
function diagramBook(fen) {
  return (
    `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\n` +
    `::chess-diagram{fen="${fen}"}\n\n:::\n`
  );
}

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

  // The island drops a value it cannot read, exactly as it drops an unknown
  // arrow colour — so the author states an evaluation and the book shows
  // nothing, with no error anywhere.
  test('an evaluation the island cannot read is reported with its line', () => {
    const result = check(
      '# One\n\n:::chess-board{id="a"}\n\n```pgn\n1. e4 {[%eval winning]} e5\n```\n\n:::\n',
    );
    assert.match(result.output, /01-chapter\.md:6: warning a: \[%eval winning\] is not an/);
  });

  // A warning, not an error: an evaluation is an annotation, and a book whose
  // chapters all read correctly should not fail to build over one.
  test('an unreadable evaluation does not fail the build', () => {
    const result = check(
      '# One\n\n:::chess-board{id="a"}\n\n```pgn\n1. e4 {[%eval winning]} e5\n```\n\n:::\n',
    );
    assert.equal(result.code, 0, result.output);
  });

  test('every form the island does read is accepted in silence', () => {
    const pgn = '1. e4 {[%eval 0.54]} e5 {[%eval -1.3]} 2. Nf3 {[%eval #5]} Nc6 {[%eval #-3]}';
    const result = check(`# One\n\n:::chess-board{id="a"}\n\n\`\`\`pgn\n${pgn}\n\`\`\`\n\n:::\n`);
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /is not an evaluation/);
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
    assert.match(result.output, /5 reference\(s\) resolve/);
  });

  test('ambiguous links and pins warn at their own lines without failing the check', () => {
    const result = check(
      gameBook('First :move[3... Bg4].\n\nAgain :move[3... Bg4].\n\n::chess-board{at="3... Bg4"}'),
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /3 reference\(s\) resolve/);
    const warnings = result.output.split('\n').filter((line) => line.includes('move-ambiguous'));
    assert.equal(warnings.length, 3, result.output);
    assert.deepEqual(
      warnings.map((line) => /01-chapter\.md:(\d+): warning move-ambiguous:/.exec(line)?.[1]),
      ['12', '14', '16'],
    );
    for (const warning of warnings) {
      assert.match(warning, /matches 2 sideline moves in "g"/);
      assert.match(warning, /first: "1\. e4 1\.\.\. c6 2\. Nf3 2\.\.\. d5 3\. e5 3\.\.\. Bg4"/);
      assert.match(
        warning,
        /Other matches: "1\. e4 1\.\.\. c6 2\. Nf3 2\.\.\. d5 3\. Nc3 3\.\.\. Bg4"/,
      );
      assert.match(warning, /add line="/);
      assert.match(warning, /identifies one route/);
    }
    assert.match(warnings[0], /:move\[3\.\.\. Bg4\]/);
    assert.match(warnings[2], /at="3\.\.\. Bg4"/);
  });

  test('ambiguity uses the same bare, spaced, case-insensitive and annotated labels as the reader', () => {
    const result = check(gameBook(':move[Bg4] :move[ 3...bg4?! ]\n\n::chessboard{at="3...Bg4+"}'));
    assert.equal(result.code, 0, result.output);
    assert.equal((result.output.match(/warning move-ambiguous:/g) ?? []).length, 3, result.output);
  });

  test('a matching mainline move retains priority without an ambiguity warning', () => {
    const result = check(gameBook(':move[4. d4] :move[d4]\n\n::chess-board{at="4.d4"}'));
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /3 reference\(s\) resolve/);
    assert.doesNotMatch(result.output, /warning/);
  });

  test('unused duplicate labels and unique sideline references do not warn', () => {
    const result = check(gameBook(':move[3. Nc3]\n\n::chess-board{at="3. e5"}'));
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /2 reference\(s\) resolve/);
    assert.doesNotMatch(result.output, /warning/);
  });

  test('an ambiguity warning does not hide an unresolved reference error', () => {
    const result = check(gameBook(':move[3... Bg4] :move[9. Rd8]'));
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /warning move-ambiguous:/);
    assert.match(result.output, /:move\[9\. Rd8\] names no move/);
    assert.match(result.output, /1 problem\(s\) in 1 game\(s\)/);
  });

  test('ambiguity diagnostics name every competing variation', () => {
    const pgn = AMBIGUOUS.replace('(3. Nc3 Bg4)', '(3. Nc3 Bg4) (3. d4 Bg4)');
    const result = check(gameBook(':move[3... Bg4]', pgn));
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /matches 3 sideline moves/);
    assert.match(result.output, /Other matches: .*3\. Nc3 3\.\.\. Bg4.*3\. d4 3\.\.\. Bg4/);
  });

  test('explicit lines resolve ambiguous links and pins without warnings', () => {
    const result = check(
      gameBook(
        ':move[3... Bg4]{line="3. Nc3 Bg4"}\n\n' + '::chess-board{at="3... Bg4" line="3. e5 Bg4"}',
      ),
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /2 reference\(s\) resolve/);
    assert.doesNotMatch(result.output, /move-ambiguous/);
  });

  test('invalid, missing and still-ambiguous explicit lines fail at the reference', () => {
    const result = check(
      gameBook(
        ':move[3... Bg4]{line=""}\n\n' +
          ':move[3... Bg4]{line="3. Nc3 4... Bg4"}\n\n' +
          ':move[3... Bg4]{line="3... Bg4"}\n\n' +
          '::chess-board{at="3... Bg4" line="3. d4 Bg4"}',
      ),
    );
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /:12: error move-line-invalid:/);
    assert.match(result.output, /:14: error move-line-invalid:/);
    assert.match(result.output, /:16: error move-line-ambiguous:/);
    assert.match(result.output, /:18: error move-line-missing:/);
    assert.match(result.output, /4 problem\(s\) in 1 game\(s\)/);
  });

  test('a valid line cannot select a target outside that line', () => {
    const result = check(gameBook(':move[1. e4]{line="3. Nc3 Bg4"}'));
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /error move-line-target:/);
  });

  test('a table can select two future routes through the same starting move', () => {
    const result = check(
      gameBook(
        '| Variation | Move |\n| --- | --- |\n' +
          '| First | :move[4... Nf6]{line="4... Nf6 5. Nxf6+ gxf6"} |\n' +
          "| Second | :move[4... Nf6]{line='4... Nf6 5. Nxf6&#43; exf6'} |\n\n" +
          "::chessboard{at='4... Nf6' line='4... Nf6 5. Nxf6+ exf6'}",
        '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 ' + '(4... Nf6 5. Nxf6+ gxf6 (5... exf6))',
      ),
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /3 reference\(s\) resolve/);
    assert.doesNotMatch(result.output, /warning|error/);
  });

  test('code examples do not become invalid explicit references', () => {
    const result = check(gameBook('`:move[bad]{line="bad"}`\n\n```\n:move[bad]{line="bad"}\n```'));
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /0 reference\(s\) resolve/);
  });
  /*
   * `at` takes the same labels as `:move[…]` and had none of the same checking.
   * Its failure is quieter, too: an unresolved pin does not render an error, it
   * renders a board that *follows the reader* — so the printed diagram the
   * author placed silently becomes a second live board.
   */
  test('a pinned board naming nothing is reported', () => {
    const body =
      `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\n` +
      `::chess-board{at="9. Rd8"}\n\n:::\n`;
    const result = check(body);
    assert.equal(result.code, 1);
    assert.match(result.output, /at="9\. Rd8" names no move in the game/);
    assert.match(result.output, /follow the reader instead of staying put/);
  });

  test('a pinned board naming a real move resolves', () => {
    const body =
      `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\n` +
      `::chess-board{at="4. Qxf7#"}\n\n:::\n`;
    const result = check(body);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /1 reference\(s\) resolve/);
  });

  // A standalone board is not inside a game, so `at` has nothing to resolve
  // against and the engine rejects it at lint time instead (`requiresInside`).
  test('a pin outside a game is left to the linter', () => {
    const result = check('# One\n\n::chess-board{id="a" at="9. Rd8" pgn="assets/g.pgn"}\n');
    assert.equal(result.code, 0, result.output);
  });

  test('a diagram of a position the game reaches is silent', () => {
    const result = check(diagramBook(AFTER_NF6));
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /warning/);
    assert.match(result.output, /1 diagram\(s\) in a game were checked/);
  });

  /*
   * Both outcomes are legal — a book may print a position from anywhere — so
   * this warns and does not fail. What it catches is a slip in 69 characters of
   * FEN silently downgrading a tap target to a picture.
   */
  test('a diagram of a position the game never reaches warns without failing', () => {
    const result = check(diagramBook('8/8/8/8/8/8/8/K6k w - - 0 1'));
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /this diagram's position does not occur in the game/);
  });

  /*
   * `positionKey` compares placement, turn, castling and en passant, and drops
   * both clocks. A FEN copied from an engine and a game replayed from a PGN
   * agree about the position and disagree about the move number, so comparing
   * whole FENs would warn about every diagram that works.
   */
  test('a diagram whose clocks differ still matches the position', () => {
    const result = check(diagramBook(AFTER_NF6.replace(/ 4 4$/, ' 0 1')));
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /warning/);
  });

  // `findByFen` checks the tree's own starting position before walking the
  // moves, so a diagram of the initial array is a legitimate tap target.
  test('a diagram of the starting position matches', () => {
    const result = check(diagramBook('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /warning/);
  });

  // Outside a game a diagram is a picture and nothing else, which is the whole
  // point of the island. Warning about it would be noise on every use.
  test('a diagram outside a game is not checked', () => {
    const result = check('# One\n\n::chess-diagram{fen="8/8/8/8/8/8/8/K6k w - - 0 1"}\n');
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /0 diagram\(s\) in a game were checked/);
  });

  /*
   * The line number used to come from searching the game block for the mark's
   * text, so two identical marks were both reported at the first one's line —
   * sending the author to a mark that is fine. The offsets come from the match
   * itself now.
   */
  test('two identical marks are reported at their own lines', () => {
    const body =
      `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${SCHOLARS}\n\`\`\`\n\n` +
      `First :move[9. Rd8].\n\nA paragraph between them.\n\nAgain :move[9. Rd8].\n\n:::\n`;
    const result = check(body);
    assert.equal(result.code, 1);

    const lines = [...result.output.matchAll(/01-chapter\.md:(\d+): error/g)].map((m) => m[1]);
    assert.equal(lines.length, 2, result.output);
    assert.notEqual(lines[0], lines[1], `both reported at line ${lines[0]}`);
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
