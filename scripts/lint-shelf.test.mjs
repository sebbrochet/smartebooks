/**
 * Run with `npm run test:scripts`.
 *
 * SPEC016 §4.2's warning applies directly here: *a negative assertion survives
 * the removal of its own subject*. The bundled shelf contains no directive-as-
 * text — B1.6 cleaned it — so a test that only ran the real books would pass
 * against a rule that detects nothing at all. Every case below supplies its own
 * offending text.
 *
 * The detector is pure, so the judgement is tested directly. Only scope needs a
 * real process.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './book-sources.mjs';
import { directivesAsText } from './lint-shelf.mjs';

/** The tokens found, which is all a caller of this ever cares about. */
const tokens = (markdown) => directivesAsText(markdown).map((found) => found.token);

describe('directivesAsText — what is live', () => {
  test('a container at the start of its line is live', () => {
    assert.deepEqual(tokens(':::quiz{id="q"}\n\nA question.\n\n:::\n'), []);
  });

  test('a leaf at the start of its line is live', () => {
    assert.deepEqual(tokens('::checkpoint{id="done" label="Done"}\n'), []);
  });

  test('an inline directive is live wherever it appears', () => {
    assert.deepEqual(tokens('He played :move[2. Bc4] and then :note[A] rang out.\n'), []);
  });

  test('a directive inside a blockquote is live', () => {
    assert.deepEqual(tokens('> :::quiz{id="q"}\n>\n> :::\n'), []);
  });

  test('the closing fence of a container is not a token', () => {
    assert.deepEqual(tokens(':::quiz{id="q"}\n\n:::\n'), []);
  });
});

describe('directivesAsText — what is text', () => {
  test('a directive in a code span is text', () => {
    assert.deepEqual(tokens('You write `:::quiz{id="x"}` to add one.\n'), [':::quiz']);
  });

  test('a directive in a fenced block is text', () => {
    assert.deepEqual(tokens('Example:\n\n```markdown\n:::quiz{id="x"}\n:::\n```\n'), [':::quiz']);
  });

  test('a block directive mid-sentence is text, because it will not parse there', () => {
    const found = directivesAsText('A board ::chess-board{at="4. Qxf7#"} goes here.\n');
    assert.deepEqual(
      found.map((item) => item.token),
      ['::chess-board'],
    );
    assert.match(found[0].where, /will not parse/);
  });

  test('an inline directive in a code span is text', () => {
    assert.deepEqual(tokens('Write `:move[Bc4]` in a sentence.\n'), [':move[']);
  });

  test('the line number is the line the reader would look at', () => {
    const found = directivesAsText('One\n\nTwo\n\nYou write `::checkpoint{id="x"}`.\n');
    assert.equal(found.length, 1);
    assert.equal(found[0].line, 5);
  });
});

describe('directivesAsText — what must not be swept up', () => {
  test('ordinary punctuation is not a directive', () => {
    const prose = 'Note: the train leaves at 10:30, and he said :smile: to nobody.\n';
    assert.deepEqual(tokens(prose), []);
  });

  test('a URL is not a directive', () => {
    assert.deepEqual(tokens('See https://example.com/a and mailto:someone for more.\n'), []);
  });

  test('a filename or an id is left alone, because neither is prose', () => {
    // SPEC016 §7.2: renaming either costs a reader their place, to fix a word
    // only this repository ever sees.
    const prose = 'The chapter 03-a-game-from-a-file.md stores chess-file-done.\n';
    assert.deepEqual(tokens(prose), []);
  });

  test('the words are not the rule: jargon in prose is not this check\u2019s business', () => {
    // "engine" is Stockfish here and the platform elsewhere, and no lint rule
    // can tell those apart. This one does not try.
    assert.deepEqual(tokens('The engine evaluates the position, island by island.\n'), []);
  });
});

describe('scope — SPEC016 QB4', () => {
  let workspace;
  let booksDir;

  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-shelf-'));
    booksDir = join(workspace, 'books');
    mkdirSync(booksDir, { recursive: true });
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  test('a book in its own repository is not held to the shelf rule', () => {
    const folder = join(booksDir, 'outside');
    mkdirSync(join(folder, 'content'), { recursive: true });
    writeFileSync(
      join(folder, 'smartbook.json'),
      JSON.stringify({
        schemaVersion: 2,
        authorId: 'example.com',
        slug: 'outside',
        title: 'Outside',
        visibility: 'private',
      }),
    );
    writeFileSync(
      join(folder, 'content', '01-chapter.md'),
      '# One\n\nYou write `:::quiz{id="x"}` to add a quiz.\n',
    );

    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'lint-content.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
    });

    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    assert.doesNotMatch(output, /shelf-directive-as-text/);
    assert.equal(run.status, 0);
  });
});
