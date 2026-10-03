/**
 * Run with `npm run test:scripts`.
 *
 * The content in a `.smartbook` is a compiled artefact, not the author's source
 * (SPEC003 E1.6). This covers the Node packager; `package.test.ts` covers the
 * browser exporter. The two build the same zip by different code, and this pair
 * is the only thing that keeps them agreeing — the same pair lost `part` once
 * (SPEC003 D7).
 *
 * Everything happens in a temp tree reached through `SMART_EBOOKS_BOOKS_DIR`
 * and `SMART_EBOOKS_DIST_DIR`: `node --test` runs files in parallel, so a test
 * that wrote into the repository's own `books/` would be read half-built by
 * another one.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { ROOT } from './book-sources.mjs';

const SLUG = 'packaged-comments-test';

const LINES = [
  '# Acte 1',
  '',
  'Le chancelier regarde le mort. <!-- il sait déjà -->',
  '',
  '<!-- SET: corps-examine, bouton-trouve -->',
  '',
  'Write a comment like this:',
  '',
  '```html',
  '<!-- this one is the subject, not a note -->',
  '```',
  '',
  ':choice[Si vous vous agenouillez]{to="2"}.',
  '',
];

/*
 * The same chapter twice, in both line endings, because the defect that got
 * past this file was entirely about `\r` (TASK014). A book written on Windows
 * is the common case, and the LF fixture alone could not reach the branches
 * that handle an opening `<!--` or a fence marker.
 */
const CHAPTER = LINES.join('\n');

const CHAPTER_CRLF = [
  '# Acte 2',
  '',
  '<!-- REQ: corps-examine',
  '     the note runs over several lines,',
  '     which is where it used to survive packaging -->',
  '',
  'Le chancelier resserre sa cape.',
  '',
  '```html',
  '<!-- shown on purpose, even on CRLF -->',
  '```',
  '',
].join('\r\n');

describe('packaging a book with authoring comments', () => {
  let workspace;
  let dist;
  let entries;
  let summary;

  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-package-'));
    const books = join(workspace, 'books');
    dist = join(workspace, 'dist');
    const folder = join(books, SLUG);
    mkdirSync(join(folder, 'content'), { recursive: true });

    writeFileSync(
      join(folder, 'smartbook.json'),
      JSON.stringify(
        {
          schemaVersion: 2,
          authorId: 'example.com',
          slug: SLUG,
          title: 'Packaged',
          visibility: 'public',
          islands: { packs: { gamebook: true } },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(folder, 'content', '01-acte-1.md'), CHAPTER);
    writeFileSync(join(folder, 'content', '02-acte-2.md'), CHAPTER_CRLF);

    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'package-book.mjs'), SLUG], {
      env: {
        ...process.env,
        SMART_EBOOKS_BOOKS_DIR: books,
        SMART_EBOOKS_DIST_DIR: dist,
      },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `packaging failed:\n${run.stdout}\n${run.stderr}`);
    summary = run.stdout;

    entries = unzipSync(new Uint8Array(readFileSync(join(dist, `${SLUG}.smartbook`))));
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  test('the packaged chapter carries none of the author’s annotations', () => {
    const markdown = strFromU8(entries['content/01-acte-1.md']);
    assert.ok(!markdown.includes('corps-examine'), 'a SET annotation reached the package');
    assert.ok(!markdown.includes('il sait déjà'), 'an inline note reached the package');
  });

  test('the prose and its choices are untouched', () => {
    const markdown = strFromU8(entries['content/01-acte-1.md']);
    assert.ok(markdown.includes('Le chancelier regarde le mort.'));
    assert.ok(markdown.includes(':choice[Si vous vous agenouillez]{to="2"}.'));
  });

  // A book that documents HTML is showing the reader a comment on purpose.
  test('a comment inside a fenced block survives', () => {
    const markdown = strFromU8(entries['content/01-acte-1.md']);
    assert.ok(markdown.includes('<!-- this one is the subject, not a note -->'));
  });

  /*
   * TASK014. A multi-line comment in a CRLF chapter was copied into the package
   * whole, and the fenced one beside it was deleted — opposite failures from
   * the same cause, neither reachable from an LF fixture.
   */
  test('a chapter written with CRLF is stripped like any other', () => {
    const markdown = strFromU8(entries['content/02-acte-2.md']);
    assert.ok(!markdown.includes('<!-- REQ:'), 'a multi-line annotation reached the package');
    assert.ok(!markdown.includes('used to survive packaging'), 'its later lines reached it too');
    assert.ok(markdown.includes('Le chancelier resserre sa cape.'), 'the prose was lost');
  });

  test('a CRLF chapter keeps its fenced comment and its line endings', () => {
    const markdown = strFromU8(entries['content/02-acte-2.md']);
    assert.ok(markdown.includes('<!-- shown on purpose, even on CRLF -->'), 'content was deleted');
    assert.ok(!/(?<!\r)\n/.test(markdown), 'the package has line endings the author never wrote');
  });

  /*
   * The count is the reason TASK014 could happen quietly: the packager produced
   * a normal-looking summary while stripping nothing at all. Three strippable
   * comments across the two chapters; the two fenced ones are content and are
   * not counted.
   */
  test('the packager says how many comments it stripped', () => {
    assert.match(summary, /3 comment\(s\) stripped/);
  });
});
