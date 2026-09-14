import { describe, it, expect } from 'vitest';
import { searchChapters, highlight, buildCorpus, searchCorpus } from './search';
import { toPlainText } from '../content/parse';
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

describe('toPlainText', () => {
  // Quiz options are ordinary task-list items, so without stripping the markers
  // a search snippet reads "- [x] Locally in your browser" instead of a
  // sentence — punctuation the reader never saw on the page.
  it('drops list scaffolding the reader never sees', () => {
    expect(toPlainText('- [x] Locally in your browser\n- [ ] On a remote server')).toBe(
      'Locally in your browser On a remote server',
    );
    expect(toPlainText('1. First\n2. Second')).toBe('First Second');
    expect(toPlainText('- plain bullet')).toBe('plain bullet');
  });

  /**
   * A block directive begins its line and was already dropped. An **inline**
   * one sits inside a sentence, and was not — so a reader searching the
   * ordinary English word "choice" was shown `:choice{to="2"}` in the snippet,
   * and a gamebook's snippets were mostly syntax.
   */
  it('drops an inline directive that renders as nothing of its own', () => {
    expect(toPlainText('If you go down at once, :choice{to="2"}.')).toBe(
      'If you go down at once, .',
    );
  });

  // The label is what the reader sees, so it is what search should match.
  it('keeps the words an inline directive puts on the page', () => {
    expect(toPlainText('A :term[palimpsest]{definition="Scraped clean."} page.')).toBe(
      'A palimpsest page.',
    );
    expect(toPlainText('Then :choice[open the door]{to="3"}.')).toBe('Then open the door.');
  });

  // Prose is not a directive just because it has a colon in it.
  it('leaves ordinary punctuation alone', () => {
    expect(toPlainText('He said: run.')).toBe('He said: run.');
    expect(toPlainText('Meet me at 10:30 sharp.')).toBe('Meet me at 10:30 sharp.');
  });

  /**
   * Comments never reach the page — `remarkRehype` runs without
   * `allowDangerousHtml` — so anything an author keeps in one is invisible to a
   * reader and was visible in search. Authoring notes and continuity
   * bookkeeping are exactly what ends up there.
   */
  it('drops an HTML comment, which the page never shows either', () => {
    expect(toPlainText('<!-- SET: haza-en-selle -->\n\nLa princesse sourit.')).toBe(
      'La princesse sourit.',
    );
  });
});
