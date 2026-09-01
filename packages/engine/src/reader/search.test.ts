import { describe, it, expect } from 'vitest';
import { searchChapters, highlight, buildCorpus, searchCorpus } from './search';
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

  /**
   * The snippet used to be centred on the *first term typed*. A query whose
   * first word appears only in the title then showed the opening of the
   * chapter, which reads exactly like a false positive.
   */
  it('centres the snippet on the earliest term that actually occurs', () => {
    const [result] = searchChapters(chapters, 'intro sub-word');
    expect(result.snippet).toContain('sub-word');
  });
});

describe('the corpus', () => {
  it('is parsed once and answers many queries', () => {
    // Per-keystroke results are only affordable because the parse is not
    // repeated per query; this is the shape that makes that possible.
    const corpus = buildCorpus(chapters);
    expect(searchCorpus(corpus, 'token')).toHaveLength(1);
    expect(searchCorpus(corpus, 'browser')).toHaveLength(1);
    expect(searchCorpus(corpus, '  ')).toEqual([]);
  });
});

describe('highlight', () => {
  it('splits a string into matched and unmatched runs', () => {
    expect(highlight('A token is text', ['token'])).toEqual([
      { text: 'A ', match: false },
      { text: 'token', match: true },
      { text: ' is text', match: false },
    ]);
  });

  it('matches regardless of case, and keeps the original casing', () => {
    expect(highlight('Token and token', ['token'])).toEqual([
      { text: 'Token', match: true },
      { text: ' and ', match: false },
      { text: 'token', match: true },
    ]);
  });

  // A `<mark>` inside a `<mark>` renders as a darker patch for no reason a
  // reader could explain, so overlapping terms are merged into one run.
  it('merges overlapping terms rather than nesting them', () => {
    expect(highlight('tokenise', ['token', 'kenise'])).toEqual([{ text: 'tokenise', match: true }]);
  });

  it('leaves text alone when nothing matches', () => {
    expect(highlight('nothing here', ['zzz'])).toEqual([{ text: 'nothing here', match: false }]);
    expect(highlight('nothing here', [])).toEqual([{ text: 'nothing here', match: false }]);
  });
});
