import { describe, expect, it } from 'vitest';
import { hashFor, resolveLaunchRoute, resumeChapter, type LaunchInputs } from './launch';
import type { AppRoute } from './router';

const lastRead = { bookSlug: 'guide', chapterSlug: '02-interactivity-toolkit', at: 1 };

function decide(overrides: Partial<LaunchInputs> = {}) {
  return resolveLaunchRoute({
    route: { view: 'shelf' } as AppRoute,
    lastRead,
    mode: 'instant',
    suppressed: false,
    ...overrides,
  });
}

describe('resolveLaunchRoute', () => {
  it('resumes the last book from the bare entry route', () => {
    expect(decide()).toEqual({
      kind: 'resume',
      bookSlug: 'guide',
      chapterSlug: '02-interactivity-toolkit',
    });
  });

  it('never hijacks a deep link into a book', () => {
    const route: AppRoute = { view: 'book', bookSlug: 'chess', chapterSlug: '01-chess-basics' };
    expect(decide({ route })).toEqual({ kind: 'route' });
  });

  it('never hijacks a search link', () => {
    const route: AppRoute = { view: 'search', bookSlug: 'guide', query: 'token' };
    expect(decide({ route })).toEqual({ kind: 'route' });
  });

  it('shows the library on a first visit (nothing read yet)', () => {
    expect(decide({ lastRead: undefined })).toEqual({ kind: 'route' });
  });

  it('respects the "always show my library" preference', () => {
    expect(decide({ mode: 'shelf' })).toEqual({ kind: 'route' });
  });

  it('stays on the library when the reader asked for it this session', () => {
    // Guards the trap where the brand link bounces straight back into a book.
    expect(decide({ suppressed: true })).toEqual({ kind: 'route' });
  });

  it('shows the cover splash in cover mode', () => {
    expect(decide({ mode: 'cover' })).toEqual({
      kind: 'cover',
      bookSlug: 'guide',
      chapterSlug: '02-interactivity-toolkit',
    });
  });

  it('skips the cover animation when reduced motion is preferred', () => {
    expect(decide({ mode: 'cover', reducedMotion: true }).kind).toBe('resume');
  });

  it('resumes a book with no recorded chapter', () => {
    expect(decide({ lastRead: { bookSlug: 'guide', at: 1 } })).toEqual({
      kind: 'resume',
      bookSlug: 'guide',
      chapterSlug: undefined,
    });
  });
});

describe('hashFor', () => {
  it('builds book and chapter hashes', () => {
    expect(hashFor('guide')).toBe('#/guide');
    expect(hashFor('guide', '01-intro')).toBe('#/guide/01-intro');
  });
});

describe('resumeChapter', () => {
  const chapters = [
    { slug: '01-intro' },
    { slug: '02-interactivity-toolkit' },
    { slug: '03-tracking' },
  ];

  it('opens the chapter the book itself remembers', () => {
    expect(resumeChapter({ chapters, slug: 'guide', saved: { chapterSlug: '03-tracking' } })).toBe(
      '03-tracking',
    );
  });

  /**
   * The device pointer is readable synchronously, which is the only reason it
   * is consulted: it lets the common case redirect before anything paints.
   */
  it('falls back to the device pointer when it names this book', () => {
    expect(resumeChapter({ chapters, slug: 'guide', lastRead })).toBe('02-interactivity-toolkit');
  });

  it('ignores the device pointer when it names a different book', () => {
    expect(resumeChapter({ chapters, slug: 'chess', lastRead })).toBeUndefined();
  });

  it('prefers the book’s own record over the device pointer', () => {
    expect(
      resumeChapter({ chapters, slug: 'guide', lastRead, saved: { chapterSlug: '03-tracking' } }),
    ).toBe('03-tracking');
  });

  it('does nothing for a book that has never been opened', () => {
    expect(resumeChapter({ chapters, slug: 'guide' })).toBeUndefined();
  });

  /**
   * A corrected edition may have renamed or dropped that chapter. Redirecting
   * to a slug the book no longer has would open chapter one anyway, but with a
   * URL that lies about it.
   */
  it('does nothing when the remembered chapter is gone', () => {
    expect(
      resumeChapter({ chapters, slug: 'guide', saved: { chapterSlug: '09-removed' } }),
    ).toBeUndefined();
  });

  /** Rewriting the URL to say what it already means costs a history entry. */
  it('does nothing when the answer is the first chapter', () => {
    expect(
      resumeChapter({ chapters, slug: 'guide', saved: { chapterSlug: '01-intro' } }),
    ).toBeUndefined();
  });

  it('does nothing for a book with no chapters at all', () => {
    expect(
      resumeChapter({
        chapters: [],
        slug: 'guide',
        saved: { chapterSlug: '02-interactivity-toolkit' },
      }),
    ).toBeUndefined();
  });
});
