import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';
import { chapterHeadings, chapterUnits, headingHref, slugify } from './headings';

const registry = createIslandRegistry(defaultIslands);

function html(markdown: string, headingLink?: (id: string) => string) {
  return renderToStaticMarkup(
    <BookProvider slug="demo" trusted registry={registry}>
      {renderMarkdown(markdown, { registry, headingLink })}
    </BookProvider>,
  );
}

describe('slugify', () => {
  it('makes a fragment out of a heading', () => {
    expect(slugify('Why islands?')).toBe('why-islands');
    expect(slugify('  Mixed  Case — and punctuation!  ')).toBe('mixed-case-and-punctuation');
  });

  // Stripping accents rather than folding them loses a letter per accent and
  // makes two different French headings collide.
  it('folds diacritics instead of dropping the letter', () => {
    expect(slugify('Créer un agent')).toBe('creer-un-agent');
    expect(slugify('Año')).toBe('ano');
  });

  it('never returns an empty id', () => {
    expect(slugify('***')).toBe('');
    expect(chapterHeadings('## ***\n\n## ***')[0]?.id).toBe('section');
  });
});

describe('chapterHeadings', () => {
  const markdown = [
    '# Chapter title',
    '',
    '## Why islands',
    '',
    'Text.',
    '',
    '### A detail',
    '',
    '#### Too deep for the list',
    '',
    '## Why islands',
    '',
    'A second section with the same name.',
  ].join('\n');

  it('lists the sections, excluding the chapter title', () => {
    expect(chapterHeadings(markdown).map((h) => h.text)).toEqual([
      'Why islands',
      'A detail',
      'Why islands',
    ]);
  });

  it('numbers a repeated heading rather than pointing two entries at one id', () => {
    expect(chapterHeadings(markdown).map((h) => h.id)).toEqual([
      'why-islands',
      'a-detail',
      'why-islands-1',
    ]);
  });

  /**
   * The reason this reads a parsed tree rather than scanning lines: a quiz
   * writes its questions as `###`, and in the bundled books *every* `###` is a
   * quiz question. A contents list built from raw Markdown would advertise
   * questions as sections and link to headings the reader never sees, because
   * the island replaces its own body.
   */
  it('ignores headings that belong to an island, not to the chapter', () => {
    const withQuiz = [
      '## A real section',
      '',
      ':::quiz{id="q"}',
      '### What does a token represent?',
      '',
      '- [x] A chunk of text',
      ':::',
    ].join('\n');

    expect(chapterHeadings(withQuiz).map((h) => h.text)).toEqual(['A real section']);
  });
});

describe('heading ids in the rendered chapter', () => {
  it('gives every section an id', () => {
    expect(html('## Why islands')).toContain('id="why-islands"');
  });

  it('leaves the chapter title alone', () => {
    expect(html('# Chapter title')).not.toContain('id=');
  });

  /**
   * The pair that has to agree. The id is computed while walking the rendered
   * tree; the contents entry is computed from the Markdown. Two sluggers that
   * drift produce links that scroll nowhere — a failure a reader meets and an
   * author never does.
   */
  it('agrees with the contents list, id for id', () => {
    const markdown = [
      '# Title',
      '',
      '## Créer un agent',
      '',
      '### Overview',
      '',
      '## Overview',
    ].join('\n');

    const rendered = html(markdown);
    for (const heading of chapterHeadings(markdown)) {
      expect(rendered).toContain(`id="${heading.id}"`);
    }
  });

  /**
   * The same pair, asked the harder way. The test above only checks that each
   * contents id exists *somewhere* in the chapter, which a drifting slugger can
   * satisfy by having given that id to a different heading entirely.
   *
   * A heading deeper than the contents list's own `maxDepth` is where the two
   * walks disagree: the renderer slugs every `h2`–`h6`, so a deep duplicate
   * consumes the plain name and pushes the real section to `-1`.
   */
  it('agrees about which heading owns the id, not just that it exists', () => {
    const markdown = ['# Title', '', '#### Overview', '', '## Overview'].join('\n');

    const [section] = chapterHeadings(markdown);
    expect(section.depth).toBe(2);
    expect(html(markdown)).toContain(`<h2 id="${section.id}"`);
  });

  // The app is hash-routed, so `href="#section"` would replace the route and
  // navigate the reader out of the chapter instead of down it.
  it('links a heading to itself through the route, not a bare fragment', () => {
    const output = html('## Why islands', (id) => headingHref('/guide', '01-intro', id));
    expect(output).toContain('href="#/guide/01-intro?s=why-islands"');
    expect(output).not.toContain('href="#why-islands"');
  });

  it('adds no anchor when the caller supplies no route', () => {
    const output = html('## Why islands');
    expect(output).toContain('id="why-islands"');
    expect(output).not.toContain('heading-anchor');
  });
});

describe('chapterUnits', () => {
  const book = [
    '# The Caves',
    '',
    'You stand at the mouth of the cave.',
    '',
    '## 1',
    '',
    'A door. ::choice{to="2"}',
    '',
    '### A note for the curious',
    '',
    'Deeper headings belong to their unit.',
    '',
    '## 2',
    '',
    'You are eaten.',
  ].join('\n');

  it('carries the title and opening prose as a preamble, not as a unit', () => {
    const { preamble, units } = chapterUnits(book);

    expect(preamble).toContain('# The Caves');
    expect(preamble).toContain('You stand at the mouth');
    expect(units.map((unit) => unit.id)).toEqual(['1', '2']);
  });

  // A unit is delivered alone, so it has to bring its own title with it.
  it('gives each unit its own heading and body', () => {
    const [first] = chapterUnits(book).units;

    expect(first.title).toBe('1');
    expect(first.markdown).toContain('## 1');
    expect(first.markdown).toContain('::choice{to="2"}');
    expect(first.markdown).not.toContain('You are eaten');
  });

  // Units sit at one level; a deeper heading is a heading *within* a unit.
  it('keeps a deeper heading inside its unit rather than splitting on it', () => {
    const [first] = chapterUnits(book).units;

    expect(first.markdown).toContain('### A note for the curious');
    expect(chapterUnits(book).units).toHaveLength(2);
  });

  // The property that makes this safe to deliver piecemeal: splitting a file
  // into units must not lose or duplicate a word of it.
  it('accounts for every word of the file', () => {
    const { preamble, units } = chapterUnits(book);
    const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

    expect(squash([preamble, ...units.map((unit) => unit.markdown)].join(' '))).toBe(squash(book));
  });

  it('splits at the depth it is asked for', () => {
    expect(chapterUnits(book, 3).units.map((unit) => unit.title)).toEqual([
      'A note for the curious',
    ]);
  });

  // The same rule the contents list follows: a `:::quiz` writes its questions
  // as headings, and they are the island's, not the chapter's.
  it('does not split on a heading that belongs to an island', () => {
    const withIsland = ['# Title', '', '## 1', '', ':::quiz', '', '## Not a section', '', ':::'];

    expect(chapterUnits(withIsland.join('\n')).units.map((unit) => unit.id)).toEqual(['1']);
  });

  it('has no units when nothing sits at the depth', () => {
    const { preamble, units } = chapterUnits('# Title\n\nJust prose.');

    expect(units).toEqual([]);
    expect(preamble).toContain('Just prose.');
  });

  // §3.1's case: four hundred sections in one file, each addressable.
  it('addresses four hundred sections in one file', () => {
    const many = ['# Sections', ...Array.from({ length: 400 }, (_, n) => `## ${n + 1}\n\nProse.`)];
    const { units } = chapterUnits(many.join('\n\n'));

    expect(units).toHaveLength(400);
    expect(new Set(units.map((unit) => unit.id)).size).toBe(400);
    expect(units[399].markdown.startsWith('## 400')).toBe(true);
  });
});
