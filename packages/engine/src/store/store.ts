import { get, set, del, entries } from 'idb-keyval';

/**
 * Local-only, per-book persistence facade. All reader state lives in the
 * browser (IndexedDB via idb-keyval). No network, no accounts. Every key is
 * namespaced by the book slug so multiple books never collide. Designed so a
 * future cloud SyncBackend could slot behind these functions.
 */
const ROOT = 'smart-ebooks:';

function keyFor(bookSlug: string, key: string): string {
  return `${ROOT}${bookSlug}:${key}`;
}

// --- Change notification (drives the progress dashboard) --------------------

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

export function subscribeToStore(listener: StoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export async function loadState<T>(bookSlug: string, key: string, fallback: T): Promise<T> {
  try {
    const value = await get<T>(keyFor(bookSlug, key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function saveState<T>(bookSlug: string, key: string, value: T): Promise<void> {
  try {
    await set(keyFor(bookSlug, key), value);
  } catch {
    // Local persistence is best-effort; never throw into the UI.
  }
  notify();
}

/** Delete all stored state for one book. */
export async function clearBook(bookSlug: string): Promise<void> {
  const prefix = `${ROOT}${bookSlug}:`;
  const all = await entries();
  await Promise.all(
    all
      .filter(([k]) => typeof k === 'string' && (k as string).startsWith(prefix))
      .map(([k]) => del(k)),
  );
  notify();
}

/** Delete all stored state for every book on this device. */
export async function clearAllBooks(): Promise<void> {
  const all = await entries();
  await Promise.all(
    all
      .filter(([k]) => typeof k === 'string' && (k as string).startsWith(ROOT))
      .map(([k]) => del(k)),
  );
  notify();
}

// --- Domain facades ---------------------------------------------------------

export interface CheckpointState {
  complete: boolean;
  at?: number;
}

export const progress = {
  key: (id: string) => `progress:${id}`,
  setComplete(bookSlug: string, id: string, complete: boolean): Promise<void> {
    return saveState<CheckpointState>(bookSlug, progress.key(id), { complete, at: Date.now() });
  },
};

export interface QuizScore {
  score: number;
  total: number;
  attempts: number;
  at: number;
}

export const scores = {
  key: (id: string) => `score:${id}`,
  record(bookSlug: string, id: string, result: Omit<QuizScore, 'at'>): Promise<void> {
    return saveState<QuizScore>(bookSlug, scores.key(id), { ...result, at: Date.now() });
  },
};

/** Where the reader had got to in a book. */
export interface ReadingPosition {
  chapterSlug: string;
  at: number;
}

/**
 * The furthest/most recent place the reader was in this book. Kept per book (so
 * it travels with a progress backup) and used by the platform to resume.
 */
export const reading = {
  key: 'reading:position',
  get(bookSlug: string): Promise<ReadingPosition | undefined> {
    return loadState<ReadingPosition | undefined>(bookSlug, reading.key, undefined);
  },
  set(bookSlug: string, chapterSlug: string): Promise<void> {
    return saveState<ReadingPosition>(bookSlug, reading.key, { chapterSlug, at: Date.now() });
  },
};

// --- Aggregate stats (for the progress dashboard) ---------------------------

export interface BookStats {
  sectionsComplete: number;
  quizScore: number;
  quizTotal: number;
  quizzesTaken: number;
}

/** Aggregate one book's progress and quiz points from the local store. */
export async function readBookStats(bookSlug: string): Promise<BookStats> {
  let sectionsComplete = 0;
  let quizScore = 0;
  let quizTotal = 0;
  let quizzesTaken = 0;

  const prefix = `${ROOT}${bookSlug}:`;
  try {
    const all = await entries();
    for (const [rawKey, value] of all) {
      if (typeof rawKey !== 'string' || !rawKey.startsWith(prefix)) continue;
      const key = rawKey.slice(prefix.length);
      if (key.startsWith('progress:')) {
        if ((value as CheckpointState)?.complete) sectionsComplete++;
      } else if (key.startsWith('score:')) {
        const score = value as QuizScore | null;
        if (score) {
          quizScore += score.score;
          quizTotal += score.total;
          quizzesTaken++;
        }
      }
    }
  } catch {
    // On failure, return zeroed stats rather than throwing into the UI.
  }

  return { sectionsComplete, quizScore, quizTotal, quizzesTaken };
}

// --- Reader-state backup (export/import progress as JSON) --------------------

/** Local-state keys we are willing to export/import (defense against injection). */
const BACKUP_KEY_PREFIXES = ['progress:', 'score:', 'review:', 'media:', 'game:', 'reading:'];

export interface ProgressBackup {
  format: 'smart-ebooks-progress';
  schemaVersion: 1;
  exportedAt: string;
  scope: 'all' | 'book';
  bookSlug?: string;
  /** By book slug → { '<key>': value }. */
  books: Record<string, Record<string, unknown>>;
}

export interface ImportProgressResult {
  booksImported: number;
  entriesImported: number;
}

/**
 * Export the reader's local progress (all books, or one) as a portable JSON
 * object. Personal state only — never book content.
 */
export async function exportProgress(bookSlug?: string): Promise<ProgressBackup> {
  const books: Record<string, Record<string, unknown>> = {};
  try {
    const all = await entries();
    for (const [rawKey, value] of all) {
      if (typeof rawKey !== 'string' || !rawKey.startsWith(ROOT)) continue;
      const rest = rawKey.slice(ROOT.length); // "<slug>:<key>"
      const sep = rest.indexOf(':');
      if (sep < 0) continue;
      const slug = rest.slice(0, sep);
      const key = rest.slice(sep + 1);
      if (bookSlug && slug !== bookSlug) continue;
      if (!BACKUP_KEY_PREFIXES.some((p) => key.startsWith(p))) continue;
      (books[slug] ??= {})[key] = value;
    }
  } catch {
    // Return whatever was gathered rather than throwing into the UI.
  }

  return {
    format: 'smart-ebooks-progress',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    scope: bookSlug ? 'book' : 'all',
    bookSlug,
    books,
  };
}

/**
 * Restore reader progress from an exported backup. Only known key prefixes are
 * written (untrusted input is filtered). `merge` keeps existing state; `replace`
 * first clears each affected book.
 */
export async function importProgress(
  data: unknown,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportProgressResult> {
  const backup = data as Partial<ProgressBackup> | null;
  if (
    !backup ||
    backup.format !== 'smart-ebooks-progress' ||
    typeof backup.books !== 'object' ||
    backup.books === null
  ) {
    throw new Error('Not a valid Smart Ebooks progress backup.');
  }

  let booksImported = 0;
  let entriesImported = 0;

  for (const [slug, bookEntries] of Object.entries(backup.books)) {
    if (!slug || typeof bookEntries !== 'object' || bookEntries === null) continue;
    if (mode === 'replace') await clearBook(slug);

    let touched = false;
    for (const [key, value] of Object.entries(bookEntries as Record<string, unknown>)) {
      if (!BACKUP_KEY_PREFIXES.some((p) => key.startsWith(p))) continue;
      await set(keyFor(slug, key), value);
      entriesImported++;
      touched = true;
    }
    if (touched) booksImported++;
  }

  notify();
  return { booksImported, entriesImported };
}
