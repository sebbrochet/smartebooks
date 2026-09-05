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

/**
 * A book whose chapter titles sort alphabetically into the wrong order.
 *
 * Roman numerals are the case that makes it obvious, and they are what real
 * numbered fiction uses: `localeCompare` puts II before IX before V, and drops
 * "premier" in the middle of them. Every chapter below carries the same term
 * exactly once, in body text only, so nothing separates them on relevance and
 * the tie-break is the only thing under test.
 */
const numbered: Chapter[] = [
  { slug: '01', order: 1, title: 'Chapitre premier', markdown: '# Chapitre premier\n\nZol entra.' },
  { slug: '02', order: 2, title: 'Chapitre II', markdown: '# Chapitre II\n\nZol entra.' },
  { slug: '05', order: 5, title: 'Chapitre V', markdown: '# Chapitre V\n\nZol entra.' },
  { slug: '09', order: 9, title: 'Chapitre IX', markdown: '# Chapitre IX\n\nZol entra.' },
  { slug: '10', order: 10, title: 'Chapitre X', markdown: '# Chapitre X\n\nZol entra.' },
];

describe('result order', () => {
  it('breaks ties on the order the book is read in, not on the title', () => {
    const { chapters: hits } = queryIndex(buildIndex(numbered), 'zol');

    // Nothing here is *about* Zol — no title or heading names him — so nothing
    // separates these chapters and the book decides.
    expect(hits.map((hit) => hit.score)).toEqual([0, 0, 0, 0, 0]);
    expect(hits.map((hit) => hit.title)).toEqual([
      'Chapitre premier',
      'Chapitre II',
      'Chapitre V',
      'Chapitre IX',
      'Chapitre X',
    ]);
  });

  it('does not let a chapter outrank an earlier one by saying the word more often', () => {
    // The defect this replaced: searching a novel for its protagonist ranked
    // the book by how often he is named, so chapter XV came first and chapter
    // one came last. A chapter is not more *about* someone for mentioning them
    // twice as much — that is mostly a longer chapter.
    const repetitive: Chapter[] = [
      { slug: '01', order: 1, title: 'Chapitre premier', markdown: '# Chapitre premier\n\nPaul.' },
      {
        slug: '02',
        order: 2,
        title: 'Chapitre II',
        markdown: '# Chapitre II\n\nPaul, Paul, Paul, Paul et encore Paul.',
      },
    ];

    const { chapters: hits } = queryIndex(buildIndex(repetitive), 'paul');
    expect(hits.map((hit) => hit.order)).toEqual([1, 2]);
  });

  it('still puts relevance first', () => {
    // The later chapter names the term in its title, which outranks a mention
    // in the body of an earlier one. Reading order is the tie-break, not the
    // sort.
    const withTitle: Chapter[] = [
      ...numbered,
      { slug: '18', order: 18, title: 'Zol', markdown: '# Zol\n\nUne fin.' },
    ];

    const { chapters: hits } = queryIndex(buildIndex(withTitle), 'zol');
    expect(hits[0].title).toBe('Zol');
    expect(hits[0].order).toBe(18);
  });

  it('orders equally scoring passages within a chapter by where they appear', () => {
    const long: Chapter[] = [
      {
        slug: '01',
        order: 1,
        title: 'Chapitre premier',
        markdown: [
          '# Chapitre premier',
          '',
          '## Le matin',
          '',
          'Zol entra.',
          '',
          '## Le soir',
          '',
          'Zol sortit.',
        ].join('\n'),
      },
    ];

    const { chapters: hits } = queryIndex(buildIndex(long), 'zol');
    expect(hits[0].passages.map((passage) => passage.heading?.text)).toEqual([
      'Le matin',
      'Le soir',
    ]);
  });
});

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
