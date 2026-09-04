import { useEffect, useState } from 'react';
import { getLastRead, getResumeMode, type LastRead, type ResumeMode } from '@smart-ebooks/engine';
import type { AppRoute } from './router';

/** Session flag: the reader deliberately went to the library this session. */
const SUPPRESS_KEY = 'smart-ebooks:shelfRequested';

export type LaunchDecision =
  | { kind: 'route' }
  | { kind: 'resume'; bookSlug: string; chapterSlug?: string }
  | { kind: 'cover'; bookSlug: string; chapterSlug?: string };

export interface LaunchInputs {
  route: AppRoute;
  lastRead?: LastRead;
  mode: ResumeMode;
  /** The reader asked for the library this session, so don't resume over it. */
  suppressed: boolean;
  /** Honour `prefers-reduced-motion` by skipping the cover animation. */
  reducedMotion?: boolean;
}

/**
 * Decides what the app should show on a **fresh load**.
 *
 * Only the bare entry route (`#/`) is ever redirected — a deep link into a book
 * or a search must always win, or shared/bookmarked URLs would break. Returning
 * `{ kind: 'route' }` means "render whatever the hash says".
 */
export function resolveLaunchRoute({
  route,
  lastRead,
  mode,
  suppressed,
  reducedMotion = false,
}: LaunchInputs): LaunchDecision {
  if (route.view !== 'shelf') return { kind: 'route' };
  if (suppressed || mode === 'shelf') return { kind: 'route' };
  if (!lastRead?.bookSlug) return { kind: 'route' };

  const target = { bookSlug: lastRead.bookSlug, chapterSlug: lastRead.chapterSlug };
  // A cover splash is an animation; readers who asked for less motion skip it.
  return mode === 'cover' && !reducedMotion
    ? { kind: 'cover', ...target }
    : { kind: 'resume', ...target };
}

export function hashFor(bookSlug: string, chapterSlug?: string): string {
  return chapterSlug ? `#/${bookSlug}/${chapterSlug}` : `#/${bookSlug}`;
}

/**
 * Which chapter `#/<slug>` should actually open — the reader's place in that
 * book, not its first page.
 *
 * `resolveLaunchRoute` above answers "which book, on a fresh load". This
 * answers "where in a book, whenever one is opened without naming a chapter",
 * and the two were never the same question. Going back to the library and
 * opening the same book again is not a page load, so the launch decision never
 * ran; `#/<slug>` meant "no chapter in the route", which the reader rendered as
 * chapter one. A reader reported it, and they were right: it is the thing the
 * word *resume* promises hardest.
 *
 * Two sources, deliberately in this order:
 *
 * - **The book's own `reading:position`** is authoritative. It is per book, so
 *   it survives reading something else in between, and it is what a progress
 *   backup carries.
 * - **The device's `lastRead`** is consulted only when it names this same book.
 *   It is worth having because it is readable *synchronously*, so the common
 *   case — the book you were just in — redirects before anything paints,
 *   instead of showing chapter one and then jumping.
 *
 * Returns `undefined` when there is nothing to do, including when the answer is
 * the first chapter: rewriting the URL to say what it already means would spend
 * a history entry to change nothing.
 */
export function resumeChapter({
  chapters,
  slug,
  lastRead,
  saved,
}: {
  chapters: readonly { slug: string }[];
  slug: string;
  lastRead?: LastRead;
  saved?: { chapterSlug?: string };
}): string | undefined {
  const candidate =
    saved?.chapterSlug ?? (lastRead?.bookSlug === slug ? lastRead.chapterSlug : undefined);
  if (!candidate) return undefined;

  // A corrected edition may have renamed or dropped the chapter the reader was
  // on. Sending them to a slug the book no longer has would open chapter one
  // anyway, but with a URL that lies about it.
  if (!chapters.some((chapter) => chapter.slug === candidate)) return undefined;
  if (candidate === chapters[0]?.slug) return undefined;

  return candidate;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function isSuppressed(): boolean {
  try {
    return sessionStorage.getItem(SUPPRESS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Remember that the reader chose the library, so refreshing doesn't throw them
 * back into a book. Cleared when they open a book again.
 */
export function suppressResume(): void {
  try {
    sessionStorage.setItem(SUPPRESS_KEY, '1');
  } catch {
    // ignore
  }
}

export function allowResume(): void {
  try {
    sessionStorage.removeItem(SUPPRESS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Evaluates the launch decision **once per page load**.
 *
 * This is deliberately not reactive to later route changes: if it were, tapping
 * the "Smart Ebooks" brand link (which points at `#/`) would immediately bounce
 * the reader back into their book, making the library unreachable.
 */
export function useLaunchDecision(route: AppRoute): {
  pending?: { bookSlug: string; chapterSlug?: string };
  dismiss: () => void;
} {
  const [pending, setPending] = useState<{ bookSlug: string; chapterSlug?: string } | undefined>();

  useEffect(() => {
    const decision = resolveLaunchRoute({
      route,
      lastRead: getLastRead(),
      mode: getResumeMode(),
      suppressed: isSuppressed(),
      reducedMotion: prefersReducedMotion(),
    });

    if (decision.kind === 'resume') {
      window.location.replace(hashFor(decision.bookSlug, decision.chapterSlug));
    } else if (decision.kind === 'cover') {
      setPending({ bookSlug: decision.bookSlug, chapterSlug: decision.chapterSlug });
    }
    // Intentionally load-time only — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pending, dismiss: () => setPending(undefined) };
}
