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
  /** Declared asset paths (packaged/resolved in Phase 2). */
  assets?: string[];
  /** Island packs this book declares (SPEC006 F1.1). */
  islands?: SmartbookIslands;
  /** Publication intent; absent means `private` (SPEC003 E1.1). */
  visibility?: SmartbookVisibility;
}

/**
 * Whether a book may be published to the web. Deliberately not `!== 'private'`:
 * anything unrecognised — absent, misspelt, a stray value from a hand-edited
 * file — must fall to private rather than to public.
 */
export function isPublic(descriptor: Pick<SmartbookDescriptor, 'visibility'>): boolean {
  return descriptor.visibility === 'public';
}
