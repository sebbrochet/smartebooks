import { readFileSync, readdirSync, lstatSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root, derived from this file so the scripts work from any cwd. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Where books are read from, and where packages are written.
 *
 * Both are overridable so a book kept in a **separate private repository**
 * (SPEC003 E1.1) can be linted and packaged by these scripts without ever
 * being copied into this one. That is the safe half of the private-book
 * workflow: only *previewing* needs a link into `books/`, and a link there
 * blocks the build (see `check-publishable.mjs`).
 *
 *   SMART_EBOOKS_BOOKS_DIR   directory containing book folders (default `books/`)
 *   SMART_EBOOKS_DIST_DIR    where `.smartbook` files are written (default `dist/`)
 *
 * Resolved against the current working directory, so a relative value means
 * what it looks like from the private repo, not from this file.
 */
export const BOOKS_DIR = process.env.SMART_EBOOKS_BOOKS_DIR
  ? resolve(process.env.SMART_EBOOKS_BOOKS_DIR)
  : join(ROOT, 'books');

export const DIST_DIR = process.env.SMART_EBOOKS_DIST_DIR
  ? resolve(process.env.SMART_EBOOKS_DIST_DIR)
  : join(ROOT, 'dist');

/** Kept in step with `SMARTBOOK_SCHEMA_VERSION` / `MIN_SUPPORTED_SCHEMA`. */
const CURRENT_SCHEMA = 2;
const MIN_SCHEMA = 1;

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/*
 * Duplicated from `packages/engine/src/package/edition.ts`, for the same reason
 * `deriveChapters` duplicates `makeChapters`: these scripts cannot load the
 * engine's TypeScript. Kept honest by `book-sources.test.mjs`, which checks the
 * two agree on a shared table of cases.
 */
const LABEL_CHARS = /^[a-z0-9-]+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

/** A domain or reverse-DNS publisher id. Label by label, so it cannot backtrack. */
export function isAuthorId(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 253) return false;

  const labels = value.split('.');
  return (
    labels.length >= 2 &&
    labels.every(
      (label) => LABEL_CHARS.test(label) && !label.startsWith('-') && !label.endsWith('-'),
    )
  );
}

/** True when an edition string is one this platform can put in order. */
export function isOrderableEdition(value) {
  if (typeof value !== 'string') return false;

  const date = ISO_DATE.exec(value);
  if (date) {
    const [, year, month, day] = date.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }
  return SEMVER.test(value);
}

/**
 * Every folder under `books/` that has a descriptor.
 *
 * Deliberately follows symlinks and Windows junctions. An author previewing a
 * book kept in a *private* repository points a link at it, and Vite's glob
 * follows that link and bundles the content — so if this did not, the linter
 * and the publication gate would be blind to a book the build happily ships.
 * That was verified, not assumed: a junctioned private book leaked into
 * `dist/assets/index-*.js` while `check-publishable` reported nothing wrong.
 */
export function listBookFolders() {
  return readdirSync(BOOKS_DIR, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((name) => isDirectory(join(BOOKS_DIR, name)))
    .filter((name) => fileExists(join(BOOKS_DIR, name, 'smartbook.json')))
    .sort();
}

/**
 * Whether a book folder is a symlink or junction rather than real content.
 *
 * Such a book exists only on this machine, so the site could never be rebuilt
 * from the repository alone — which is why `check-publishable` refuses to build
 * when one is present, whatever its `visibility` says.
 */
export function isLinkedBookFolder(folder) {
  try {
    return lstatSync(join(BOOKS_DIR, folder)).isSymbolicLink();
  } catch {
    return false;
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
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

/** The first level-1 heading, or a fallback. Mirrors the engine's `extractTitle`. */
function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : fallback;
}

/**
 * The book's chapters in order, as `SmartbookChapterEntry` values.
 *
 * **This must agree with the engine's `makeBook` / `makeChapters`**, because a
 * package built here and one exported from the browser have to describe the
 * same book. The rules are: a declared `chapters` array wins; otherwise order
 * comes from a numeric filename prefix (999 without one) and the title from the
 * first `#` heading. Duplicated rather than imported because these scripts
 * cannot load the engine's TypeScript — the same tax `island-contract.json`
 * pays, and `package.test.mjs` is what keeps the two honest.
 *
 * @param folder book folder name
 * @param files  `[{ path, markdown }]` for the book's content
 */
export function deriveChapters(descriptor, files) {
  const byFile = new Map(files.map(({ path, markdown }) => [path.split('/').pop(), markdown]));

  if (Array.isArray(descriptor.chapters) && descriptor.chapters.length > 0) {
    return descriptor.chapters
      .map((entry, index) => {
        const markdown = byFile.get(entry.file) ?? '';
        const slug = entry.file.replace(/\.md$/, '');
        const prefix = slug.match(/^(\d+)/);
        return {
          file: entry.file,
          order: entry.order ?? (prefix ? Number.parseInt(prefix[1], 10) : index),
          title: entry.title ?? extractTitle(markdown, slug),
          // Omitted rather than written as `undefined`, so a book with no
          // parts round-trips to the same bytes it started from.
          ...(entry.part ? { part: entry.part } : {}),
        };
      })
      .sort((a, b) => a.order - b.order);
  }

  return [...byFile.entries()]
    .map(([file, markdown]) => {
      const slug = file.replace(/\.md$/, '');
      const match = slug.match(/^(\d+)/);
      return {
        file,
        order: match ? Number.parseInt(match[1], 10) : 999,
        title: extractTitle(markdown, slug),
      };
    })
    .sort((a, b) => a.order - b.order);
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
  // Every descriptor problem points at the same file, so callers can render a
  // clickable `path:line` without parsing the message.
  const fail = (rule, message) =>
    problems.push({ folder, file: 'smartbook.json', line: 1, rule, message });

  let descriptor;
  try {
    descriptor = readDescriptor(folder);
  } catch (error) {
    fail('descriptor-unreadable', `smartbook.json could not be parsed: ${error.message}`);
    return problems;
  }

  const { schemaVersion, slug, title, visibility, chapters, authorId, edition } = descriptor;

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

  /*
   * `authorId` is required *here* and optional in the reader (SPEC003 E1.2).
   *
   * Required at authoring time, because it is what stops two people's
   * `study-guide` being one book on a reader's shelf, and a field that is
   * optional for authors is a field most books will not have. Optional at
   * import, because packages published before it existed are already on
   * shelves and refusing them would throw away the progress it protects.
   */
  if (authorId === undefined) {
    fail(
      'author-missing',
      'authorId is required — a domain you control, e.g. "example.com". It scopes this book\'s ' +
        "identity so another author's book with the same slug stays a different book.",
    );
  } else if (!isAuthorId(authorId)) {
    fail('author-invalid', 'authorId must be a domain, e.g. "example.com".');
  }

  // Optional, but useless unless it can be ordered: a free-form version cannot
  // answer "is this newer than the copy I have?".
  if (edition !== undefined && !isOrderableEdition(edition)) {
    fail(
      'edition-invalid',
      'edition must be an ISO date (2026-09-04) or semver (1.2.0), so editions can be ordered.',
    );
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

  // Parts are referenced by id, precisely so a mistyped one can be caught here
  // rather than silently dropping a chapter out of its group at read time.
  for (const problem of checkParts(descriptor)) {
    problems.push({ folder, file: 'smartbook.json', line: 1, ...problem });
  }

  // Asset references resolve by exact path at runtime, and a miss is silent:
  // the reader simply shows nothing. Catch it here, where it can still be fixed.
  for (const problem of checkDeclaredAssets(descriptor, listBookFiles(folder, 'assets'))) {
    fail(problem.rule, problem.message);
  }

  return problems;
}

/**
 * Chapter grouping problems: a part a chapter names but the book never
 * declares, two parts sharing an id, a malformed entry, or a part nothing
 * points at.
 *
 * Pure, so it can be tested without a fixture book on disk.
 *
 * The reason parts are referenced by **id** rather than written as a label on
 * each chapter is this function: a label grouped by string equality means one
 * typo silently splits a part in two, and nothing can tell that from an author
 * who meant it. An id gives the mistake somewhere to be caught.
 *
 * @param descriptor parsed smartbook.json
 */
export function checkParts(descriptor) {
  const problems = [];
  const parts = Array.isArray(descriptor.parts) ? descriptor.parts : [];
  const chapters = Array.isArray(descriptor.chapters) ? descriptor.chapters : [];

  for (const [index, part] of parts.entries()) {
    if (!part?.id || !part?.title) {
      problems.push({
        rule: 'part-invalid',
        message: `parts[${index}] needs both an "id" and a "title".`,
      });
    }
  }

  const ids = parts.map((part) => part?.id).filter(Boolean);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicates)) {
    problems.push({
      rule: 'part-duplicate',
      message: `two parts share the id "${id}" — a chapter could not say which it meant.`,
    });
  }

  const declared = new Set(ids);
  for (const entry of chapters) {
    if (entry?.part !== undefined && !declared.has(entry.part)) {
      problems.push({
        rule: 'part-unknown',
        message: `chapter "${entry.file}" names part "${entry.part}", which this book does not declare.`,
      });
    }
  }

  // A part nothing points at draws no heading. That is dead weight in the
  // descriptor rather than a broken page, so it is a warning: it must not stop
  // a build, and it must not stop the content checks that run after it.
  const used = new Set(chapters.map((entry) => entry?.part).filter(Boolean));
  for (const id of declared) {
    if (!used.has(id)) {
      problems.push({
        rule: 'part-empty',
        severity: 'warning',
        message: `part "${id}" has no chapters, so it is never shown.`,
      });
    }
  }

  return problems;
}

/**
 * Descriptor asset references that the book does not actually ship.
 *
 * Pure, so it can be tested without a fixture book on disk.
 *
 * @param descriptor parsed smartbook.json
 * @param assets     book-relative asset paths that exist
 */ export function checkDeclaredAssets(descriptor, assets) {
  const problems = [];
  const present = new Set(assets);
  const { cover } = descriptor;

  if (typeof cover === 'string' && cover.startsWith('assets/') && !present.has(cover)) {
    problems.push({ rule: 'asset-missing', message: `cover "${cover}" does not exist.` });
  }

  if (Array.isArray(descriptor.assets)) {
    for (const path of descriptor.assets) {
      if (typeof path === 'string' && !present.has(path)) {
        problems.push({
          rule: 'asset-missing',
          message: `declared asset "${path}" does not exist.`,
        });
      }
    }
  }

  return problems;
}
