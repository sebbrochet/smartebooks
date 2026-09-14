/**
 * Run with `npm run test:scripts`.
 *
 * The gamebook rules were written long before anything an author runs could
 * reach them. These are about the join, not the rules: that `lint:content`
 * assembles the graph from **every** chapter of a book, and that it reports
 * what it finds where an author can open it.
 *
 * Spawns a real process because `BOOKS_DIR` is resolved when the module is
 * first imported, so it cannot be re-pointed in-process. `spawnSync` and not
 * `execFileSync`, because warnings go to stderr and `execFileSync` returns only
 * stdout on a clean run — a whole severity would be untestable.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './book-sources.mjs';

let booksDir;

function book(slug, files, descriptor = {}) {
  mkdirSync(join(booksDir, slug, 'content'), { recursive: true });
  writeFileSync(
    join(booksDir, slug, 'smartbook.json'),
    JSON.stringify({
      schemaVersion: 2,
      authorId: 'example.com',
      slug,
      title: slug,
      visibility: 'private',
      unitDepth: 2,
      islands: { packs: { gamebook: {} } },
      ...descriptor,
    }),
  );
  for (const [name, markdown] of Object.entries(files)) {
    writeFileSync(join(booksDir, slug, 'content', name), markdown);
  }
}

function lint() {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(ROOT, 'scripts', 'lint-content.mjs')],
    {
      encoding: 'utf8',
      env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
    },
  );
  return { code: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const ACT_ONE = ['# Act one', '', '## 1', '', 'A door. :choice{to="2"}.'].join('\n');
const ACT_TWO = ['# Act two', '', '## 2', '', ':ending[It ends.]'].join('\n');

describe('a gamebook is checked as one book', () => {
  // A directory per test: the linter reports every book it finds, so one broken
  // fixture left behind would fail every test written after it.
  beforeEach(() => {
    booksDir = mkdtempSync(join(tmpdir(), 'smart-ebooks-gamebook-'));
  });
  afterEach(() => rmSync(booksDir, { recursive: true, force: true }));

  /**
   * The rule this whole join exists for. Section 1 is in the first file and the
   * section it offers is in the second, so a per-file check would call it
   * broken — and an author who is told a correct book is broken stops reading
   * the output.
   */
  test('a choice may cross a file boundary', () => {
    book('crossing', { '01-one.md': ACT_ONE, '02-two.md': ACT_TWO });

    const { code, output } = lint();

    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /choice-target/);
  });

  test('a choice to a section that exists nowhere is an error', () => {
    book('broken', {
      '01-one.md': ['# Act one', '', '## 1', '', 'A door. :choice{to="99"}.'].join('\n'),
      '02-two.md': ACT_TWO,
    });

    const { code, output } = lint();

    assert.equal(code, 1);
    assert.match(output, /choice-target/);
    assert.match(output, /content\/01-one\.md:3/);
  });

  /**
   * Ids are slugged one file at a time, so two acts can both open a `## 1` and
   * nothing in the engine notices — the reader keeps the first. Since a link
   * now names a section without naming its file, that is the check the
   * addressing rests on.
   */
  test('two files may not claim the same section number', () => {
    book('twins', {
      '01-one.md': ACT_ONE,
      '02-two.md': [
        '# Act two',
        '',
        '## 2',
        '',
        ':ending[It ends.]',
        '',
        '## 1',
        '',
        'Again.',
      ].join('\n'),
    });

    const { code, output } = lint();

    assert.equal(code, 1);
    assert.match(output, /duplicate-id/);
    // Reported where the second one is written, which is the one to delete.
    assert.match(output, /content\/02-two\.md:7/);
  });

  test('a section a reader cannot leave is an error', () => {
    book('stuck', {
      '01-one.md': ACT_ONE,
      '02-two.md': ['# Act two', '', '## 2', '', 'And then nothing.'].join('\n'),
    });

    const { code, output } = lint();

    assert.equal(code, 1);
    assert.match(output, /dead-end/);
  });

  test('a book that declares no gamebook pack is not asked', () => {
    book('ordinary', { '01-one.md': '# Prose\n\n## Overview\n\nWords.\n' }, { islands: {} });

    const { code, output } = lint();

    assert.equal(code, 0, output);
  });

  test('a gamebook with no unitDepth says so rather than passing quietly', () => {
    book('unitless', { '01-one.md': ACT_ONE }, { unitDepth: undefined });

    const { code, output } = lint();

    assert.equal(code, 0, output);
    assert.match(output, /gamebook-unitless/);
  });
});
