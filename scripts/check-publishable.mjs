/**
 * Refuses to build the site when `books/` contains anything not marked public.
 *
 * This has to be a *build-step* check, not a runtime one: `import.meta.glob` is
 * eager, so every Markdown file under `books/` is compiled into the JS bundle
 * before any filtering code runs. Filtering the shelf hides a private book from
 * the UI while still shipping its content — the same silent exposure D1
 * describes.
 *
 * Runs automatically via the `prebuild` script.
 */
import { listBookFolders, readDescriptor, validateBook } from './book-sources.mjs';

const folders = listBookFolders();
const problems = folders.flatMap(validateBook);

if (problems.length > 0) {
  for (const { folder, rule, message } of problems) {
    console.error(`books/${folder}/smartbook.json: ${rule}: ${message}`);
  }
  process.exit(1);
}

const notPublic = folders.filter((folder) => readDescriptor(folder).visibility !== 'public');

if (notPublic.length > 0) {
  for (const folder of notPublic) {
    const { visibility } = readDescriptor(folder);
    console.error(
      `books/${folder}: visibility is "${visibility}", but everything under books/ is compiled\n` +
        `  into the site bundle. Move it to a private repository and package it instead:\n` +
        `      npm run package -- ${folder}`,
    );
  }
  console.error(`\nRefusing to build: ${notPublic.length} non-public book(s) under books/.`);
  process.exit(1);
}

console.log(`publishing ${folders.length} book(s): ${folders.join(', ')}`);
