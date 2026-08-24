import { describe, it, expect } from 'vitest';
import { makeChapters } from './makeChapters';
import { extractTitle, toPlainText } from './parse';

describe('makeChapters', () => {
  const modules: Record<string, string> = {
    '/books/x/content/02-second.md': '# Second\n\nbody two',
    '/books/x/content/01-first.md': '# First\n\nbody one',
  };

  it('sorts by numeric filename prefix and derives slug/title', () => {
    const chapters = makeChapters(modules);
    expect(chapters.map((c) => c.slug)).toEqual(['01-first', '02-second']);
    expect(chapters[0].title).toBe('First');
    expect(chapters[0].order).toBe(1);
  });
});

describe('parse helpers', () => {
  it('extracts a level-1 title with a fallback', () => {
    expect(extractTitle('# Hello world\n\nbody', 'fallback')).toBe('Hello world');
    expect(extractTitle('no heading here', 'fallback')).toBe('fallback');
  });

  it('strips directives and markdown for plain text', () => {
    const md = [
      '# Title',
      '',
      ':::quiz{id="x"}',
      '### Q',
      '- [x] a',
      ':::',
      '',
      'Real **text**.',
    ].join('\n');
    const text = toPlainText(md);
    expect(text).toContain('Real text');
    expect(text).not.toContain(':::');
    expect(text).not.toContain('**');
  });
});
