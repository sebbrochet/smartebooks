/**
 * Run with `npm run test:scripts`.
 *
 * A `chess-game` prints a comment in exactly one place — the score the author
 * places with `::chess-moves`. Without it the annotations are parsed, attached
 * and rendered nowhere, which is invisible in a diff and invisible on the page.
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

const ANNOTATED = '1. e4 e5 2. Bc4 {Eyeing f7.} Nc6 3. Qh5 Nf6?? 4. Qxf7#';

function lint(markdown) {
  const folder = join(booksDir, DESCRIPTOR.slug);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(join(folder, 'content'), { recursive: true });
  writeFileSync(join(folder, 'smartbook.json'), JSON.stringify(DESCRIPTOR, null, 2));
  writeFileSync(join(folder, 'content', '01-chapter.md'), markdown);

  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'lint-content.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
  });

  return { code: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

const game = (body) =>
  `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${ANNOTATED}\n\`\`\`\n${body}\n:::\n`;

describe('lint-chess', () => {
  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-chess-'));
    booksDir = join(workspace, 'books');
    mkdirSync(booksDir, { recursive: true });
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  test('warns when a game has annotations and no score to show them in', () => {
    const { output } = lint(game('\nSome prose about it.\n'));
    assert.match(output, /chess-comment-hidden/);
    assert.match(output, /1 annotation/);
  });

  test('is a warning, not an error: the chapter still reads', () => {
    const { code } = lint(game('\nSome prose about it.\n'));
    assert.equal(code, 0);
  });

  test('says nothing when the author placed a score', () => {
    const { output } = lint(game('\nSome prose.\n\n::chess-moves\n'));
    assert.doesNotMatch(output, /chess-comment-hidden/);
  });

  test('says nothing about a game carrying no annotations', () => {
    const plain = '1. e4 e5 2. Bc4 Nc6';
    const { output } = lint(
      `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${plain}\n\`\`\`\n\nProse.\n\n:::\n`,
    );
    assert.doesNotMatch(output, /chess-comment-hidden/);
  });

  // A comment holding only a drawing still reaches the reader, on the board.
  test('a comment that is only a shape is not a lost annotation', () => {
    const shapesOnly = '1. e4 e5 2. Bc4 {[%cal Gc4f7]} Nc6';
    const { output } = lint(
      `# One\n\n:::chess-game{id="g"}\n\n\`\`\`pgn\n${shapesOnly}\n\`\`\`\n\nProse.\n\n:::\n`,
    );
    assert.doesNotMatch(output, /chess-comment-hidden/);
  });

  test('a book that declares no chess pack is not asked', () => {
    const folder = join(booksDir, 'plain');
    mkdirSync(join(folder, 'content'), { recursive: true });
    writeFileSync(
      join(folder, 'smartbook.json'),
      JSON.stringify({ ...DESCRIPTOR, slug: 'plain', islands: { packs: {} } }, null, 2),
    );
    writeFileSync(join(folder, 'content', '01-chapter.md'), '# One\n\nJust prose.\n');

    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'lint-content.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
    });
    assert.doesNotMatch(`${run.stdout ?? ''}${run.stderr ?? ''}`, /chess-comment-hidden/);
    rmSync(folder, { recursive: true, force: true });
  });
});
