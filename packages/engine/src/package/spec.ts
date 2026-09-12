/**
 * The `.smartbook` package specification — a **declarative, code-free** format
 * for portable smart books (backup + sharing). A package is a zip containing:
 *
 *   smartbook.json          (this descriptor)
 *   content/<file>.md       (chapters)
 *   assets/…                (media — resolved at import time, Phase 2)
 *
 * The same descriptor also backs bundled books (each `books/<slug>/` ships a
 * `smartbook.json`), unifying the built-in and imported paths. A bundled book
 * is *only* this descriptor plus its content and assets — there is no code, so
 * a book can be written by a generator, an agent, or by hand.
 */

/** Schema version this build writes. */
export const SMARTBOOK_SCHEMA_VERSION = 2;

/**
 * Oldest schema this build can still read. Packages are accepted across a
 * *range*, not by exact match: an older package stays readable, and a newer one
 * is readable when it declares a `minReaderSchema` we satisfy. Exact-match
 * versioning would make every schema change a flag day in both directions.
 */
export const MIN_SUPPORTED_SCHEMA = 1;

export interface SmartbookChapterEntry {
  /** Filename relative to `content/`, e.g. `01-intro.md`. */
  file: string;
  /** Display order; defaults to the numeric filename prefix. */
  order?: number;
  /** Display title; defaults to the chapter's first heading. */
  title?: string;
  /**
   * The `id` of a part declared in {@link SmartbookDescriptor.parts}. Chapters
   * with no part sit at the top level, which is how a preface or an appendix
   * stays outside the grouping.
   */
  part?: string;
}

/**
 * A named group of chapters — "Part I — Foundations", "Annexes".
 *
 * Declared **once**, and referenced by chapters by `id`. The obvious cheaper
 * design is a label on each chapter (`part: "Part I — Foundations"`), and it is
 * wrong for the same reason duplicate ids were: grouping on string equality
 * means one typo silently splits a part in two, and nothing anywhere can tell
 * that from an author who meant it. An `id` gives the linter a reference to
 * check, like `assets` and island packs already have.
 *
 * Order is the array's own order. Parts do **not** nest: a chapter belongs to
 * at most one, and the reader's chapter list is one level deep. Deeper trees
 * can be added later without changing this, because a part is a view over the
 * flat chapter sequence rather than a replacement for it.
 */
export interface SmartbookPart {
  /** Stable identifier, referenced by `chapters[].part`. */
  id: string;
  /** Display title, e.g. "Part I — Foundations". */
  title: string;
}

export interface SmartbookEngineRange {
  min?: string;
  max?: string;
}

export interface SmartbookIslands {
  /**
   * Island packs this book uses, keyed by pack name, with per-book options.
   * The host maps a name to its implementation; the book carries only data.
   * Built-in islands are always available and need not be listed.
   */
  packs?: Record<string, unknown>;
  /**
   * Canonical names of the islands this book's content uses (SPEC001 P2.1).
   * A reader that cannot provide one of these can say so once, up front,
   * instead of leaving unexplained gaps through the book.
   */
  required?: string[];
}

/**
 * Publication intent. **Absent means `private`** — a safe default that is
 * occasionally inconvenient beats one that occasionally publishes something
 * personal. Note this only governs the *site*; keeping private content out of a
 * public repository is the primary control (SPEC003 E1.1).
 */
export type SmartbookVisibility = 'public' | 'private';

export interface SmartbookDescriptor {
  schemaVersion: number;
  /**
   * Oldest reader schema able to render this package. Defaults to
   * `schemaVersion` (assume no backward compatibility unless stated).
   */
  minReaderSchema?: number;
  /**
   * Stable, machine-comparable publisher id — a domain or reverse-DNS, e.g.
   * `sebbrochet.com` (SPEC003 E1.2).
   *
   * **Optional in the type, required by the linter.** The spec asks for it to
   * be required, and for new books it is: `lint:content` rejects a descriptor
   * without one. It cannot be required *here*, because packages already in
   * readers' hands were written before the field existed, and refusing to open
   * them would throw away exactly the progress this field exists to protect.
   * Absent means "the unscoped namespace", which is what those books have
   * always been in.
   */
  authorId?: string;
  /**
   * This book's edition: an ISO date (`2026-09-04`) or semver (`1.2.0`).
   *
   * Restricted to those two so it can be *ordered*, which is the only thing it
   * is for — deciding whether an imported package is newer than the copy a
   * reader already has. See `edition.ts`.
   */
  edition?: string;
  slug: string;
  title: string;
  description?: string;
  authors?: string[];
  createdAt?: string;
  /** Cover image, as a packaged asset path (e.g. `assets/cover.png`). */
  cover?: string;
  /** Engine compatibility range (advisory). */
  engine?: SmartbookEngineRange;
  /** Chapters in order; if omitted, derived from the content folder. */
  chapters?: SmartbookChapterEntry[];
  /**
   * The heading depth at which this book's files carry **units** — 2 for `##`
   * (SPEC005 M2).
   *
   * A file is then a container of units rather than a page, and the reader is
   * delivered one unit at a time. Absent means what every book has meant so
   * far: the file is the page.
   *
   * Declared on the book rather than per file, because a book whose files
   * disagree about what a unit is has no answer for what `?s=` addresses.
   */
  unitDepth?: number;
  /** Named groups of chapters, in display order (SPEC005). */
  parts?: SmartbookPart[];
  /** Declared asset paths (packaged/resolved in Phase 2). */
  assets?: string[];
  /** Island packs this book declares (SPEC006 F1.1). */
  islands?: SmartbookIslands;
  /**
   * The language this book is written in, as a BCP 47 tag: `fr`, `en-GB`,
   * `pt-BR` (SPEC010 M1).
   *
   * The reader marks the book's prose with it, which is what decides
   * hyphenation and how a screen reader pronounces the text. Absent means the
   * shell's own language, which is the behaviour every book had before this
   * field existed.
   *
   * Deliberately **one** language. A book in two languages is two books
   * grouped by the library — see SPEC010, which reversed SPEC001 Q8 on this.
   */
  language?: string;
  /** Publication intent; absent means `private` (SPEC003 E1.1). */
  visibility?: SmartbookVisibility;
}

/** The longest a BCP 47 tag may be before it stops being a language. */
const MAX_LANGUAGE_LENGTH = 35;

/**
 * Whether `value` is a language tag we are willing to put in a `lang`
 * attribute.
 *
 * A permissive subset of BCP 47 rather than the grammar: a primary subtag of
 * two or three letters, then any number of alphanumeric subtags of two to
 * eight characters. That accepts `fr`, `en-GB`, `zh-Hant-TW` and `pt-BR`, and
 * rejects the things that matter — an empty tag, a sentence, a leading or
 * doubled hyphen, anything long enough to be a payload.
 *
 * **Checked subtag by subtag rather than with one pattern.** The obvious regex
 * nests a quantifier inside a quantifier, which is the shape that backtracks
 * badly on a hostile string, and this value arrives inside a zip from
 * somewhere else. `isAuthorId` is written the same way for the same reason.
 */
export function isLanguageTag(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.length > MAX_LANGUAGE_LENGTH) return false;

  const subtags = value.split('-');
  const [primary, ...rest] = subtags;

  if (primary.length < 2 || primary.length > 3) return false;
  if (!isAlpha(primary)) return false;

  return rest.every((subtag) => subtag.length >= 2 && subtag.length <= 8 && isAlphanumeric(subtag));
}

function isAlpha(subtag: string): boolean {
  for (const character of subtag) {
    const code = character.toLowerCase().charCodeAt(0);
    if (code < 97 || code > 122) return false;
  }
  return true;
}

function isAlphanumeric(subtag: string): boolean {
  for (const character of subtag) {
    const code = character.toLowerCase().charCodeAt(0);
    const letter = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (!letter && !digit) return false;
  }
  return true;
}

/**
 * Whether a book may be published to the web. Deliberately not `!== 'private'`:
 * anything unrecognised — absent, misspelt, a stray value from a hand-edited
 * file — must fall to private rather than to public.
 */
export function isPublic(descriptor: Pick<SmartbookDescriptor, 'visibility'>): boolean {
  return descriptor.visibility === 'public';
}
