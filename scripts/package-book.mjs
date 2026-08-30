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
  DIST_DIR,
  deriveChapters,
  listBookFiles,
  listBookFolders,
  listContentFiles,
  readDescriptor,
  validateBook,
} from './book-sources.mjs';
import { checkDirectives, usedIslands } from './lint-islands.mjs';

function packageBook(folder) {
  const problems = validateBook(folder);
  if (problems.length > 0) {
    for (const { file, line, rule, message } of problems) {
      console.error(
        `books/${folder}/${file ?? 'smartbook.json'}:${line ?? 1}: ${rule}: ${message}`,
      );
    }
    throw new Error(`Cannot package "${folder}": ${problems.length} problem(s).`);
  }

  const descriptor = readDescriptor(folder);
  const contentPaths = listContentFiles(folder);
  const assetPaths = listBookFiles(folder, 'assets');
  const contentFiles = contentPaths.map((path) => ({
    path,
    markdown: readFileSync(join(BOOKS_DIR, folder, path), 'utf8'),
  }));

  // Package a book with broken islands and the problem only appears on the
  // recipient's screen, where nobody can fix it. The descriptor pass above is
  // not enough on its own.
  const contentProblems = checkDirectives(descriptor, contentFiles, folder, assetPaths);
  const errors = contentProblems.filter((problem) => problem.severity !== 'warning');
  for (const { file, line, rule, message, severity } of contentProblems) {
    const at = `books/${folder}/${file ?? 'smartbook.json'}:${line ?? 1}`;
    const text = `${at}: ${severity === 'warning' ? 'warning' : 'error'} ${rule}: ${message}`;
    if (severity === 'warning') console.warn(text);
    else console.error(text);
  }
  if (errors.length > 0) {
    throw new Error(`Cannot package "${folder}": ${errors.length} content problem(s).`);
  }

  // The browser exporter rewrites the descriptor with resolved chapters (E2.3)
  // and the islands the content uses (P2.1). This path must do the same, or a
  // package built here would be quietly poorer than the same book exported from
  // a tab — and the private-repo workflow can only use this path.
  const packaged = {
    ...descriptor,
    chapters: deriveChapters(descriptor, contentFiles),
    islands: { ...descriptor.islands, required: usedIslands(descriptor, contentFiles) },
  };

  const files = { 'smartbook.json': strToU8(`${JSON.stringify(packaged, null, 2)}\n`) };

  for (const relPath of [...contentPaths, ...assetPaths]) {
    files[relPath] = new Uint8Array(readFileSync(join(BOOKS_DIR, folder, relPath)));
  }

  const zipped = zipSync(files, { level: 6 });
  mkdirSync(DIST_DIR, { recursive: true });

  const out = join(DIST_DIR, `${descriptor.slug}.smartbook`);
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
