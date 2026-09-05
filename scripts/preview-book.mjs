/**
 * Previews a book kept in a separate repository, with a live edit loop.
 *
 * The library discovers books with a glob over `books/<slug>/smartbook.json`,
 * and a glob pattern must be a static literal — so it cannot be pointed at
 * another repo the way the linter and the packager can. Instead the book is
 * linked into `books/` for the duration of the dev server and unlinked on exit.
 *
 * Two safety properties, both verified rather than assumed:
 *
 *   1. Removing a directory junction/symlink with `rmSync(recursive: false)`
 *      deletes *the link only*; the target is untouched.
 *   2. `check-publishable.mjs` refuses to build while any book folder is a
 *      link, so a forgotten link cannot publish content by accident.
 *
 * The link is named after the slug because the linter requires a book's folder
 * name and its descriptor's slug to match.
 *
 *   SMART_EBOOKS_BOOKS_DIR=../my-repo/books node scripts/preview-book.mjs [slug]
 */
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS_DIR, ROOT, listBookFolders, readDescriptor } from './book-sources.mjs';

const OWN_BOOKS = join(ROOT, 'books');

/** Windows needs `junction` for directories; POSIX ignores the type argument. */
const DIR_LINK = process.platform === 'win32' ? 'junction' : 'dir';

const slug = process.argv[2] ?? soleBookSlug();
const target = join(BOOKS_DIR, slug);
const link = join(OWN_BOOKS, slug);

function soleBookSlug() {
  const folders = listBookFolders();
  if (folders.length !== 1) {
    console.error(
      `Usage: node scripts/preview-book.mjs <slug>   (found: ${folders.join(', ') || 'none'})`,
    );
    process.exit(1);
  }
  return folders[0];
}

function unlink() {
  // Only ever remove something we know is a link.
  try {
    if (lstatSync(link).isSymbolicLink()) rmSync(link, { recursive: false, force: true });
  } catch {
    /* already gone */
  }
}

if (!existsSync(target)) {
  console.error(`No book at ${target}.`);
  process.exit(1);
}

const descriptor = readDescriptor(slug);
const linking = target !== link;

if (linking) {
  if (existsSync(link)) {
    if (lstatSync(link).isSymbolicLink()) {
      unlink(); // Left over from an interrupted run.
    } else {
      console.error(
        `${link} already exists and is not a link.\n` +
          `This repository has a real book called "${slug}". Rename the book's slug.`,
      );
      process.exit(1);
    }
  }

  symlinkSync(target, link, DIR_LINK);
  process.on('exit', unlink);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => process.exit(0));
  }

  console.log(`Linked "${slug}" (${descriptor.visibility}) into the platform.`);
  console.log('Edits reload live. Ctrl+C removes the link.\n');
}

/*
 * Asynchronous on purpose. `spawnSync` blocks the event loop for as long as the
 * dev server runs, so the `exit` handler above could never fire: on Windows,
 * Ctrl+C tore the tree down and left the junction behind — with the child still
 * holding port 5173, which showed up as "Port is in use" on the next run. The
 * header above promised Ctrl+C removed the link; until this was `spawn`, it did not.
 */
const child = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: true });
child.on('error', (error) => {
  console.error(`Could not start the dev server: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
