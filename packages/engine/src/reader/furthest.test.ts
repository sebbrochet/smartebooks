import { describe, it, expect } from 'vitest';
import { furthestOf } from './furthest';
import type { Chapter } from '../types';

const chapters: Chapter[] = ['01-one', '02-two', '03-three'].map((slug, i) => ({
  slug,
  order: i + 1,
  title: slug,
  markdown: `# ${slug}`,
}));

describe('furthestOf', () => {
  it('is the current chapter when there is no mark yet', () => {
    expect(furthestOf(chapters, undefined, '02-two')).toBe('02-two');
  });

  it('advances when the reader goes further', () => {
    expect(furthestOf(chapters, '01-one', '03-three')).toBe('03-three');
  });

  /**
   * The whole point of the mark. Flipping back to re-read changes where the
   * reader *is*, not how far they have got — a progressive glossary would
   * otherwise re-hide terms the moment someone looked one up.
   */
  it('does not move backwards when the reader flips back', () => {
    expect(furthestOf(chapters, '03-three', '01-one')).toBe('03-three');
  });

  it('compares by position in the book, not alphabetically', () => {
    // '10-ten' sorts before '02-two' as a string and after it as a chapter.
    const many: Chapter[] = ['02-two', '10-ten'].map((slug, i) => ({
      slug,
      order: i + 1,
      title: slug,
      markdown: '#',
    }));
    expect(furthestOf(many, '10-ten', '02-two')).toBe('10-ten');
  });

  /**
   * A book re-edited between visits. Treating the vanished chapter as
   * infinitely far would strand the mark past the end of the book forever.
   */
  it('forgets a mark whose chapter no longer exists', () => {
    expect(furthestOf(chapters, 'deleted-chapter', '01-one')).toBe('01-one');
  });
});
