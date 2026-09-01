import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider } from '../reader/BookContext';
import { renderMarkdown } from './render';
import { chapterHeadings, headingHref, slugify } from './headings';

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

  // The app is hash-routed, so `href="#section"` would replace the route and
  // navigate the reader out of the chapter instead of down it.
  it('links a heading to itself through the route, not a bare fragment', () => {
    const output = html('## Why islands', (id) => headingHref('/guide', '01-intro', id));
    expect(output).toContain('href="#/guide/01-intro?h=why-islands"');
    expect(output).not.toContain('href="#why-islands"');
  });

  it('adds no anchor when the caller supplies no route', () => {
    const output = html('## Why islands');
    expect(output).toContain('id="why-islands"');
    expect(output).not.toContain('heading-anchor');
  });
});
