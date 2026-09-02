/**
 * Platform-level settings — preferences that belong to the reader's *device*
 * rather than to any one book (theme, how the app should open, which book was
 * open last).
 *
 * These live in `localStorage`, not IndexedDB, on purpose:
 *   - the theme must be readable **synchronously before first paint** (see the
 *     no-FOUC script in index.html), and
 *   - the launch decision must be made without an async round-trip, otherwise
 *     the shelf would flash before redirecting to the last book.
 *
 * All values are tiny. Per-book state (progress, scores, reading position)
 * stays in IndexedDB via `store.ts`.
 */

const PREFIX = 'smart-ebooks:';

export const THEME_KEY = `${PREFIX}theme`;
export const RESUME_MODE_KEY = `${PREFIX}resumeMode`;
export const LAST_READ_KEY = `${PREFIX}lastRead`;
export const READING_KEY = `${PREFIX}reading`;

/** Pre-1.0 theme key, migrated on first load. */
const LEGACY_THEME_KEY = 'smart-ebook-theme';

export type Theme = 'light' | 'dark' | 'system';

/**
 * How the platform opens when the reader returns:
 *   - `shelf`   — always show the library
 *   - `instant` — go straight back to the last book (default)
 *   - `cover`   — show the book cover briefly, then continue
 */
export type ResumeMode = 'shelf' | 'instant' | 'cover';

export const RESUME_MODES: ResumeMode[] = ['shelf', 'instant', 'cover'];

/** Pointer to the last thing the reader had open. */
export interface LastRead {
  bookSlug: string;
  chapterSlug?: string;
  at: number;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Settings are best-effort (private mode, quota); never throw into the UI.
  }
}

/**
 * Move the pre-1.0 `smart-ebook-theme` value to the namespaced key. Safe to run
 * repeatedly; it only acts when the new key is absent and the old one is valid.
 */
export function migrateLegacySettings(): void {
  if (read(THEME_KEY) !== null) return;
  const legacy = read(LEGACY_THEME_KEY);
  if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
    write(THEME_KEY, legacy);
  }
  try {
    localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    // ignore
  }
}

export function getTheme(): Theme {
  const value = read(THEME_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function setTheme(theme: Theme): void {
  write(THEME_KEY, theme);
}

/*
 * How the reader wants to read: size, spacing, line length, typeface.
 *
 * **Cross-book, like the theme, because they describe an eye rather than a
 * book.** Someone who needs larger text needs it in every book they open, and
 * being asked again by each one is the same failure as not having the setting.
 *
 * Named steps rather than numbers. The values belong in the stylesheet where a
 * skin or a print rule can reason about them, and a stored `1.0625rem` is a
 * number nobody can ever change their mind about (SPEC002 R2.1, SPEC009 T6).
 */
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';
export type TextLeading = 'tight' | 'normal' | 'loose';
export type TextMeasure = 'narrow' | 'normal' | 'wide';
export type TextFace = 'sans' | 'serif';

export interface ReadingPreferences {
  size: TextSize;
  leading: TextLeading;
  measure: TextMeasure;
  face: TextFace;
}

export const TEXT_SIZES: TextSize[] = ['small', 'medium', 'large', 'xlarge'];
export const TEXT_LEADINGS: TextLeading[] = ['tight', 'normal', 'loose'];
export const TEXT_MEASURES: TextMeasure[] = ['narrow', 'normal', 'wide'];
export const TEXT_FACES: TextFace[] = ['sans', 'serif'];

export const DEFAULT_READING: ReadingPreferences = {
  size: 'medium',
  leading: 'normal',
  measure: 'normal',
  face: 'sans',
};

function oneOf<T extends string>(allowed: T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function getReadingPreferences(): ReadingPreferences {
  const raw = read(READING_KEY);
  if (!raw) return DEFAULT_READING;

  try {
    // Every field is validated rather than trusted: this is `localStorage`,
    // which any script on the origin can write, and an unrecognised value would
    // otherwise become an attribute selector that matches nothing and silently
    // leaves the reader with no styling at all.
    const parsed = JSON.parse(raw) as Partial<ReadingPreferences>;
    return {
      size: oneOf(TEXT_SIZES, parsed?.size, DEFAULT_READING.size),
      leading: oneOf(TEXT_LEADINGS, parsed?.leading, DEFAULT_READING.leading),
      measure: oneOf(TEXT_MEASURES, parsed?.measure, DEFAULT_READING.measure),
      face: oneOf(TEXT_FACES, parsed?.face, DEFAULT_READING.face),
    };
  } catch {
    return DEFAULT_READING;
  }
}

export function setReadingPreferences(preferences: ReadingPreferences): void {
  write(READING_KEY, JSON.stringify(preferences));
}

export function getResumeMode(): ResumeMode {
  const value = read(RESUME_MODE_KEY);
  return value === 'shelf' || value === 'instant' || value === 'cover' ? value : 'instant';
}

export function setResumeMode(mode: ResumeMode): void {
  write(RESUME_MODE_KEY, mode);
}

export function getLastRead(): LastRead | undefined {
  const raw = read(LAST_READ_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as LastRead;
    return typeof parsed?.bookSlug === 'string' && parsed.bookSlug ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function setLastRead(bookSlug: string, chapterSlug?: string): void {
  write(
    LAST_READ_KEY,
    JSON.stringify({ bookSlug, chapterSlug, at: Date.now() } satisfies LastRead),
  );
}

export function clearLastRead(): void {
  try {
    localStorage.removeItem(LAST_READ_KEY);
  } catch {
    // ignore
  }
}
