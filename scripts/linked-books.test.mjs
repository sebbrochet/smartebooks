/**
 * Run with `npm run test:scripts` (Node's built-in runner — no DOM needed).
 *
 * Covers the one property that, if it regresses, silently publishes private
 * content: a book folder that is a symlink or Windows junction.
 *
 * This is not hypothetical. Linking a private book into `books/` is how it gets
 * previewed locally, and it was verified that Vite's glob **follows the link
 * and bundles the content** while `listBookFolders()` — which used to test
 * `Dirent.isDirectory()`, false for a link — did not see it at all. The
 * publication gate reported "publishing 3 books" and the private canary string
 * landed in `dist/assets/index-*.js`.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS_DIR, ROOT, isLinkedBookFolder, listBookFolders } from './book-sources.mjs';

const SLUG = 'linked-book-test';
const target = join(ROOT, 'tmp-linked-book-test', SLUG);
const link = join(BOOKS_DIR, SLUG);

/** Windows needs `junction` for directories; POSIX ignores the type argument. */
const DIR_LINK = process.platform === 'win32' ? 'junction' : 'dir';

describe('a linked book folder', () => {
  let linked = false;

  before(() => {
    mkdirSync(join(target, 'content'), { recursive: true });
    writeFileSync(
      join(target, 'smartbook.json'),
      // Public on purpose: `visibility` must not be what saves us here.
      JSON.stringify({ schemaVersion: 2, slug: SLUG, title: 'Linked', visibility: 'public' }),
    );
    writeFileSync(join(target, 'content', '01-x.md'), '# X\n\nhello\n');

    try {
      symlinkSync(target, link, DIR_LINK);
      linked = true;
    } catch {
      // Creating links can require a privilege we do not have; skip rather than
      // fail, so the suite stays runnable on a locked-down machine.
      linked = false;
    }
  });

  after(() => {
    if (linked) rmSync(link, { recursive: false, force: true });
    rmSync(join(ROOT, 'tmp-linked-book-test'), { recursive: true, force: true });
  });

  test('is discovered like any other book', (t) => {
    if (!linked) return t.skip('cannot create links on this machine');
    assert.ok(listBookFolders().includes(SLUG));
  });

  test('is recognisable as linked', (t) => {
    if (!linked) return t.skip('cannot create links on this machine');
    assert.equal(isLinkedBookFolder(SLUG), true);
    assert.equal(isLinkedBookFolder('guide'), false);
  });

  // The property that matters: the build must refuse, even though this book
  // says `visibility: "public"` and is otherwise entirely valid.
  test('stops the publication gate', (t) => {
    if (!linked) return t.skip('cannot create links on this machine');

    let exitCode = 0;
    let output = '';
    try {
      output = execFileSync(process.execPath, [join(ROOT, 'scripts', 'check-publishable.mjs')], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      exitCode = error.status;
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }

    assert.equal(exitCode, 1, 'gate should refuse to build');
    assert.match(output, /symlink\/junction/);
    assert.match(output, new RegExp(SLUG));
  });
});
