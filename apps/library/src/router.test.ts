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
});
