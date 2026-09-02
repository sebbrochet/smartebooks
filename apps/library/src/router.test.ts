import { describe, it, expect } from 'vitest';
import { parseAppHash } from './router';

describe('parseAppHash', () => {
  it('parses the shelf route', () => {
    expect(parseAppHash('#/')).toEqual({ view: 'shelf' });
    expect(parseAppHash('')).toEqual({ view: 'shelf' });
  });

  it('parses a book home route', () => {
    expect(parseAppHash('#/guide')).toEqual({
      view: 'book',
      bookSlug: 'guide',
      chapterSlug: undefined,
    });
  });

  it('parses a chapter route', () => {
    expect(parseAppHash('#/guide/01-getting-started')).toEqual({
      view: 'book',
      bookSlug: 'guide',
      chapterSlug: '01-getting-started',
    });
  });

  it('parses a search route', () => {
    expect(parseAppHash('#/guide/search?q=hello%20world')).toEqual({
      view: 'search',
      bookSlug: 'guide',
      query: 'hello world',
    });
  });

  /**
   * The parameter name is pinned deliberately. `s` is for section; `h` is left
   * free because MkDocs Material — the reader this one is measured against —
   * uses `?h=` for search *highlight terms*. Renaming this later, once books
   * contain such links, would break every published citation (SPEC002 N14).
   */
  it('parses a section within a chapter, from `s` and not `h`', () => {
    expect(parseAppHash('#/guide/01-getting-started?s=why-islands')).toEqual({
      view: 'book',
      bookSlug: 'guide',
      chapterSlug: '01-getting-started',
      heading: 'why-islands',
    });

    expect(parseAppHash('#/guide/01-getting-started?h=why-islands')).toEqual({
      view: 'book',
      bookSlug: 'guide',
      chapterSlug: '01-getting-started',
      heading: undefined,
      highlight: ['why-islands'],
    });
  });

  it('parses the terms to mark, and carries both parameters at once', () => {
    expect(parseAppHash('#/guide/01-getting-started?s=why-islands&h=island+format')).toEqual({
      view: 'book',
      bookSlug: 'guide',
      chapterSlug: '01-getting-started',
      heading: 'why-islands',
      highlight: ['island', 'format'],
    });
  });
});
