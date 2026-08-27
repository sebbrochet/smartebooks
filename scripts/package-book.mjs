/**
 * Builds a `.smartbook` from a book folder, without a browser.
 *
 *   npm run package -- <slug>
 *   npm run package -- --all
 *
 * A private book must be packaged *without ever being served*, which is what
 * makes SPEC003 E1.1's private-repo workflow practical. Before F1.1 this was
 * circular: the only way to export was to run the site and click a button.
 *
 * Because a book is now pure data, packaging is a file copy into a zip — no
 * engine, no bundler, no rendering.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import {
  BOOKS_DIR,
  ROOT,
  listBookFiles,
  listBookFolders,
  readDescriptor,
  validateBook,
} from './book-sources.mjs';

const OUT_DIR = join(ROOT, 'dist');

function packageBook(folder) {
  const problems = validateBook(folder);
  if (problems.length > 0) {
    for (const { rule, message } of problems) {
      console.error(`books/${folder}/smartbook.json: ${rule}: ${message}`);
    }
    throw new Error(`Cannot package "${folder}": ${problems.length} problem(s).`);
  }

  const descriptor = readDescriptor(folder);
  const files = { 'smartbook.json': strToU8(`${JSON.stringify(descriptor, null, 2)}\n`) };

  for (const relPath of [...listBookFiles(folder, 'content'), ...listBookFiles(folder, 'assets')]) {
    files[relPath] = new Uint8Array(readFileSync(join(BOOKS_DIR, folder, relPath)));
  }

  const zipped = zipSync(files, { level: 6 });
  mkdirSync(OUT_DIR, { recursive: true });

  const out = join(OUT_DIR, `${descriptor.slug}.smartbook`);
  writeFileSync(out, zipped);

  const kb = (zipped.length / 1024).toFixed(1);
  console.log(
    `${descriptor.slug}.smartbook  ${Object.keys(files).length} files, ${kb} kB  [${descriptor.visibility}]`,
  );
  return out;
}

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const targets = args.includes('--all') ? listBookFolders() : args;

if (targets.length === 0) {
  console.error('Usage: npm run package -- <slug> | --all');
  console.error(`Available: ${listBookFolders().join(', ')}`);
  process.exit(1);
}

try {
  for (const target of targets) {
    if (!listBookFolders().includes(target)) {
      throw new Error(`No book folder "books/${target}".`);
    }
    packageBook(target);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
