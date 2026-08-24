/**
 * The `.smartbook` package specification — a **declarative, code-free** format
 * for portable smart books (backup + sharing). A package is a zip containing:
 *
 *   smartbook.json          (this descriptor)
 *   content/<file>.md       (chapters)
 *   assets/…                (media — resolved at import time, Phase 2)
 *
 * The same descriptor also backs bundled books (each `books/<slug>/` ships a
 * `smartbook.json`), unifying the built-in and imported paths.
 */

export const SMARTBOOK_SCHEMA_VERSION = 1;

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

export interface SmartbookDescriptor {
  schemaVersion: number;
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
}
