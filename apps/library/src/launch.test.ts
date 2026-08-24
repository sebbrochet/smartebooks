import { describe, expect, it } from 'vitest';
import { hashFor, resolveLaunchRoute, type LaunchInputs } from './launch';
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
