import { describe, it, expect } from 'vitest';
import { buildIndex, queryIndex, completeTerm, termsWithPrefix, tokenize } from './searchIndex';
import type { Chapter } from '../types';

const chapters: Chapter[] = [
  {
    slug: '01-governance',
    order: 1,
    title: 'Governance and councils',
    markdown: [
      '# Governance and councils',
      '',
      'An opening paragraph before any section.',
      '',
      '## Why an AI council',
      '',
      'A council decides who may approve a deployment.',
      '',
      '## Reporting lines',
      '',
      'Reporting is quarterly. Council minutes are published.',
    ].join('\n'),
  },
  {
    slug: '02-tokens',
    order: 2,
    title: 'Tokens',
    markdown: [
      '# Tokens',
      '',
      'Tokens are the unit a model reads.',
      '',
      '## What a token is',
      '',
      'A token is a sub-word unit. Tokens are counted, and token limits apply.',
      '',
      '## Pricing',
      '',
      'Billing depends on volume; a token is the unit charged.',
      '',
      ':::quiz{id="q"}',
      '### Which of these is a token?',
      '',
      '- [x] A chunk of text',
      ':::',
    ].join('\n'),
  },
];

const index = buildIndex(chapters);

describe('tokenize', () => {
  // `\w` splits "café" into "caf" and drops the rest, which matters for the
  // French and Spanish books this platform is aimed at.
  it('keeps accented and non-Latin words whole', () => {
    expect(tokenize('Créer un agent')).toEqual(['créer', 'un', 'agent']);
    expect(tokenize('Año 2024')).toEqual(['año', '2024']);
  });

  it('is the same function for text and for queries', () => {
    // If they differed, a query could be untypeable into a match.
    expect(tokenize('Council, minutes.')).toEqual(tokenize('council minutes'));
  });
});

describe('the index', () => {
  it('indexes passages, not chapters', () => {
    // Three in the first chapter: the preamble plus two sections.
    const first = index.passages.filter((p) => p.chapterSlug === '01-governance');
    expect(first).toHaveLength(3);
    expect(first.map((p) => p.heading?.text)).toEqual([
      undefined,
      'Why an AI council',
      'Reporting lines',
    ]);
  });

  // The prose above the first heading is usually the chapter's own
  // introduction; leaving it out makes it permanently unfindable.
  it('keeps the text before the first heading, without the chapter title', () => {
    const preamble = index.passages.find((p) => p.chapterSlug === '01-governance' && !p.heading);
    expect(preamble?.text).toContain('opening paragraph');
    // The title is the result's own label. Repeating it as the excerpt spends
    // the one line of context on something already on screen.
    expect(preamble?.text).not.toContain('Governance and councils');
  });

  it('keeps a section\u2019s heading out of its own body text', () => {
    const section = index.passages.find((p) => p.heading?.id === 'why-an-ai-council');
    expect(section?.text).toBe('A council decides who may approve a deployment.');
  });

  // A quiz question is a heading in the source and never one on the page.
  it('does not treat an island\u2019s headings as sections', () => {
    expect(index.passages.map((p) => p.heading?.text)).not.toContain('Which of these is a token?');
  });
});

describe('querying', () => {
  it('points at the passage, not just the chapter', () => {
    const { chapters: hits } = queryIndex(index, 'council');
    expect(hits[0].slug).toBe('01-governance');
    expect(hits[0].passages[0].heading?.id).toBe('why-an-ai-council');
  });

  it('requires every term', () => {
    expect(queryIndex(index, 'council zzzmissing').chapters).toEqual([]);
  });

  /**
   * The asymmetry that makes typing feel like search: the word being typed is
   * still incomplete, the ones before it are not.
   */
  it('completes the last term but not the earlier ones', () => {
    expect(queryIndex(index, 'gover').chapters).toHaveLength(1);
    // "counc" as a *leading* term is not a prefix, so it matches nothing.
    expect(queryIndex(index, 'counc minutes').chapters).toEqual([]);
    expect(queryIndex(index, 'council minu').chapters).toHaveLength(1);
  });

  it('ranks a heading match above a passing mention', () => {
    const { chapters: hits } = queryIndex(index, 'token');
    const chapter = hits.find((hit) => hit.slug === '02-tokens');
    if (!chapter) throw new Error('expected the tokens chapter to match');

    // Compared by name rather than by position: "token" is the last term, so
    // it expands by prefix and the chapter's opening matches "tokens" too.
    const score = (text: string) =>
      chapter.passages.find((passage) => passage.heading?.text === text)?.score ?? 0;

    // "What a token is" is *about* tokens; "Pricing" merely mentions one.
    expect(chapter.passages[0].heading?.text).toBe('What a token is');
    expect(score('What a token is')).toBeGreaterThan(score('Pricing'));
  });

  // Otherwise a long, weakly matching chapter outranks a short exact one purely
  // by having more paragraphs.
  it('scores a chapter by its best passage, not the sum of them', () => {
    const { chapters: hits } = queryIndex(index, 'reporting');
    expect(hits[0].score).toBe(Math.max(...hits[0].passages.map((p) => p.score)));
  });

  it('counts passages, which is what the reader is offered', () => {
    const outcome = queryIndex(index, 'council');
    expect(outcome.passageCount).toBe(
      outcome.chapters.reduce((total, chapter) => total + chapter.passages.length, 0),
    );
  });
});

describe('completion', () => {
  it('offers the commonest continuation, not the first alphabetically', () => {
    // "token" sorts first, but "tokens" is the chapter's title — and a title is
    // indexed into every passage of its chapter — so "tokens" reaches two
    // passages against "token"'s one. Frequency wins over alphabet, which is
    // the whole rule: a completion is a guess about intent, and how often a
    // word is used is the only evidence the index has.
    expect(completeTerm(index, 'toke')).toBe('tokens');
  });

  it('offers nothing for a word already complete or unknown', () => {
    expect(completeTerm(index, 'zzz')).toBeUndefined();
    expect(completeTerm(index, '')).toBeUndefined();
  });

  it('finds a prefix range in the sorted terms', () => {
    expect(termsWithPrefix(index, 'coun')).toEqual(expect.arrayContaining(['council', 'councils']));
    expect(termsWithPrefix(index, 'zzz')).toEqual([]);
  });
});
