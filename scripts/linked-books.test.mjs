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
 *
 * **It used to create that link inside the repository's own `books/`, and that
 * was a race.** `node --test` runs files in parallel, so a test reading the
 * real book list could see this folder appear and then fail to read its
 * descriptor a moment later, because `after()` had removed the link in
 * between. It surfaced as `schema.test.mjs` failing with `ENOENT` on a book
 * nobody has — which looks like a schema fault and is not one. Everything now
 * happens in a temp directory reached through `SMART_EBOOKS_BOOKS_DIR`, so no
 * test mutates state another test reads.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './book-sources.mjs';

const LINKED = 'linked-book-test';
const PLAIN = 'plain-book-test';

/** Windows needs `junction` for directories; POSIX ignores the type argument. */
const DIR_LINK = process.platform === 'win32' ? 'junction' : 'dir';

/** Public on purpose: `visibility` must not be what saves us here. */
const descriptor = (slug) => ({
  schemaVersion: 2,
  authorId: 'example.com',
  slug,
  title: slug,
  visibility: 'public',
});

function writeBook(folder, slug) {
  mkdirSync(join(folder, 'content'), { recursive: true });
  writeFileSync(join(folder, 'smartbook.json'), JSON.stringify(descriptor(slug), null, 2));
  writeFileSync(join(folder, 'content', '01-x.md'), '# X\n\nhello\n');
}

describe('a linked book folder', () => {
  let workspace;
  let booksDir;
  let linked = false;

  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-linked-'));
    booksDir = join(workspace, 'books');
    mkdirSync(booksDir, { recursive: true });

    // The link's target lives inside the same temp tree, so tearing the tree
    // down cannot reach anything of the repository's through the junction.
    const target = join(workspace, 'elsewhere', LINKED);
    writeBook(target, LINKED);
    writeBook(join(booksDir, PLAIN), PLAIN);

    try {
      symlinkSync(target, join(booksDir, LINKED), DIR_LINK);
      linked = true;
    } catch {
      // Creating links can require a privilege we do not have; skip rather than
      // fail, so the suite stays runnable on a locked-down machine.
      linked = false;
    }
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  /**
   * `BOOKS_DIR` is resolved when `book-sources.mjs` is first imported, so it
   * cannot be re-pointed in this process. Asking a child is what lets the
   * question be asked about a directory that is ours.
   */
  function ask() {
    const source = `
      import { listBookFolders, isLinkedBookFolder } from ${JSON.stringify(
        pathToFileURL(join(ROOT, 'scripts', 'book-sources.mjs')).href,
      )};
      console.log(
        JSON.stringify({
          folders: listBookFolders(),
          linked: isLinkedBookFolder(${JSON.stringify(LINKED)}),
          plain: isLinkedBookFolder(${JSON.stringify(PLAIN)}),
        }),
      );
    `;
    return JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', source], {
        encoding: 'utf8',
        env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
      }),
    );
  }

  test('is discovered like any other book', (t) => {
    if (!linked) return t.skip('cannot create links on this machine');
    assert.ok(ask().folders.includes(LINKED));
  });

  // The negative case is a real book beside it. It used to be `guide`, which
  // was deleted with SPEC016 B1.5 — so the assertion went on passing against a
  // folder that did not exist, which is the trap SPEC016 §4.2 records.
  test('is recognisable as linked, and an ordinary folder is not', (t) => {
    if (!linked) return t.skip('cannot create links on this machine');
    const answer = ask();
    assert.equal(answer.linked, true);
    assert.equal(answer.plain, false);
    assert.ok(answer.folders.includes(PLAIN), 'the plain book must exist to be a fair negative');
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
        env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
      });
    } catch (error) {
      exitCode = error.status;
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }

    assert.equal(exitCode, 1, 'gate should refuse to build');
    assert.match(output, /symlink\/junction/);
    assert.match(output, new RegExp(LINKED));
  });
});
