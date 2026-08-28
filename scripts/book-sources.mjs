import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root, derived from this file so the scripts work from any cwd. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const BOOKS_DIR = join(ROOT, 'books');

/** Kept in step with `SMARTBOOK_SCHEMA_VERSION` / `MIN_SUPPORTED_SCHEMA`. */
const CURRENT_SCHEMA = 2;
const MIN_SCHEMA = 1;

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Every folder under `books/` that has a descriptor. */
export function listBookFolders() {
  return readdirSync(BOOKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fileExists(join(BOOKS_DIR, name, 'smartbook.json')))
    .sort();
}

function fileExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** All files under a book-relative directory, as book-relative POSIX paths. */
export function listBookFiles(folder, subdir) {
  const base = join(BOOKS_DIR, folder, subdir);
  if (!fileExists(base)) return [];

  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(join(BOOKS_DIR, folder), full).split('\\').join('/'));
    }
  };
  walk(base);
  return out.sort();
}

/**
 * A book's chapters: `content/**` filtered to Markdown.
 *
 * Deliberately not "everything under content/". Import keeps only `content/*.md`
 * (see `parseSmartbook`), so anything else would be linted for no reason and
 * packaged only to be discarded — and a stray editor backup or draft could be
 * shipped inside a `.smartbook` without anyone noticing.
 */
export function listContentFiles(folder) {
  return listBookFiles(folder, 'content').filter((path) => path.endsWith('.md'));
}

export function readDescriptor(folder) {
  const path = join(BOOKS_DIR, folder, 'smartbook.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Validate one book. Returns a list of problems, each with a stable `rule` id
 * so the output is machine-parseable as well as readable (SPEC006 F1.3).
 *
 * This is a deliberate subset of the full content lint (SPEC001 P1.3): it
 * checks the descriptor and the files it points at, not island syntax.
 */
export function validateBook(folder) {
  const problems = [];
  const fail = (rule, message) => problems.push({ folder, rule, message });

  let descriptor;
  try {
    descriptor = readDescriptor(folder);
  } catch (error) {
    fail('descriptor-unreadable', `smartbook.json could not be parsed: ${error.message}`);
    return problems;
  }

  const { schemaVersion, slug, title, visibility, chapters } = descriptor;

  if (!Number.isInteger(schemaVersion) || schemaVersion < MIN_SCHEMA) {
    fail('schema-version', `schemaVersion must be an integer >= ${MIN_SCHEMA}.`);
  } else if (schemaVersion > CURRENT_SCHEMA) {
    fail(
      'schema-version',
      `schemaVersion ${schemaVersion} is newer than this build (${CURRENT_SCHEMA}).`,
    );
  }

  if (typeof slug !== 'string' || !SAFE_SLUG.test(slug)) {
    fail('slug-invalid', 'slug must be lowercase alphanumeric with hyphens.');
  } else if (slug !== folder) {
    fail('slug-mismatch', `slug "${slug}" does not match its folder "${folder}".`);
  }

  if (typeof title !== 'string' || title.trim() === '') {
    fail('title-missing', 'title is required.');
  }

  // The D1 guard: publication must be a decision, never a default.
  if (visibility === undefined) {
    fail(
      'visibility-missing',
      'visibility is required — set "public" to publish, or "private" to keep it off the site.',
    );
  } else if (visibility !== 'public' && visibility !== 'private') {
    fail(
      'visibility-invalid',
      `visibility must be "public" or "private", not ${JSON.stringify(visibility)}.`,
    );
  }

  const files = listContentFiles(folder);
  if (files.length === 0) fail('content-empty', 'no chapters found under content/.');

  if (Array.isArray(chapters)) {
    for (const entry of chapters) {
      if (!files.includes(`content/${entry.file}`)) {
        fail('chapter-missing', `declared chapter "${entry.file}" does not exist.`);
      }
    }
  }

  return problems;
}
