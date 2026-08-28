/**
 * Run with `npm run test:scripts`.
 *
 * A book kept in a separate private repository (SPEC003 E1.1) must be lintable
 * and packageable **without being copied into this one**. That is the safe half
 * of the private-book workflow — only previewing needs a link into `books/`,
 * and a link there blocks the build.
 *
 * These spawn real processes because `BOOKS_DIR` and `DIST_DIR` are resolved
 * when the module is first imported, so they cannot be re-pointed in-process.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { ROOT } from './book-sources.mjs';

let workspace;
let booksDir;
let distDir;

function run(script, args, env) {
  try {
    return {
      code: 0,
      output: execFileSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, ...env },
      }),
    };
  } catch (error) {
    return { code: error.status, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

describe('books outside this repository', () => {
  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smartbook-external-'));
    booksDir = join(workspace, 'books');
    distDir = join(workspace, 'dist');
    mkdirSync(join(booksDir, 'album', 'content'), { recursive: true });
    writeFileSync(
      join(booksDir, 'album', 'smartbook.json'),
      JSON.stringify({
        schemaVersion: 2,
        slug: 'album',
        title: 'Album',
        visibility: 'private',
      }),
    );
    writeFileSync(
      join(booksDir, 'album', 'content', '01-day-one.md'),
      '# Day one\n\n:::quiz{id="q"}\n\n### Q\n\n:::\n',
    );
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  const env = () => ({ SMARTBOOK_BOOKS_DIR: booksDir, SMARTBOOK_DIST_DIR: distDir });

  test('lints a book this repo does not contain', () => {
    const { code, output } = run('lint-content.mjs', [], env());
    assert.equal(code, 0, output);
    assert.match(output, /1 book\(s\) checked, no problems/);
    // A private book is never listed as published, wherever it lives.
    assert.match(output, /published: \(none\)/);
  });

  test('packages it into the directory it was told to use', () => {
    const { code, output } = run('package-book.mjs', ['album'], env());
    assert.equal(code, 0, output);

    const zip = unzipSync(new Uint8Array(readFileSync(join(distDir, 'album.smartbook'))));
    const descriptor = JSON.parse(strFromU8(zip['smartbook.json']));

    // The CLI must write the same enriched descriptor as the browser exporter.
    assert.deepEqual(descriptor.chapters, [{ file: '01-day-one.md', order: 1, title: 'Day one' }]);
    assert.deepEqual(descriptor.islands.required, ['quiz']);
    assert.equal(descriptor.visibility, 'private');
  });

  test('reports content errors in an external book too', () => {
    writeFileSync(
      join(booksDir, 'album', 'content', '02-broken.md'),
      '::audio{id="a" src="assets/missing.mp3"}\n',
    );
    const { code, output } = run('lint-content.mjs', [], env());
    rmSync(join(booksDir, 'album', 'content', '02-broken.md'));

    assert.equal(code, 1);
    assert.match(output, /asset-missing/);
  });

  test('leaves the default location alone when nothing is set', () => {
    const { code, output } = run('lint-content.mjs', [], {});
    assert.equal(code, 0, output);
    assert.match(output, /published: chess, guide, sampler/);
  });
});
