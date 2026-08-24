import { describe, it, expect } from 'vitest';
import { searchChapters } from './search';
import type { Chapter } from '../types';

const chapters: Chapter[] = [
  {
    slug: '01-intro',
    order: 1,
    title: 'Intro to tokens',
    markdown: '# Intro to tokens\n\nA token is a sub-word unit of text.',
  },
  {
    slug: '02-more',
    order: 2,
    title: 'More topics',
    markdown: '# More topics\n\nProgress is stored locally in the browser.',
  },
];

describe('searchChapters', () => {
  it('returns nothing for an empty query', () => {
    expect(searchChapters(chapters, '   ')).toEqual([]);
  });

  it('finds a chapter by term and includes a snippet', () => {
    const results = searchChapters(chapters, 'token');
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe('01-intro');
    expect(results[0].snippet.length).toBeGreaterThan(0);
  });

  it('requires all terms to match', () => {
    expect(searchChapters(chapters, 'token zzzmissing')).toEqual([]);
  });
});
