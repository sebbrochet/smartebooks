import { describe, it, expect } from 'vitest';
import { bookUnits } from './bookUnits';
import type { Chapter } from '../types';

function chapter(slug: string, order: number, markdown: string): Chapter {
  return { slug, order, title: slug, markdown };
}

const acts = [
  chapter(
    '01-act-one',
    1,
    ['# Act One', '', '## 1', '', 'A door.', '', '## 2', '', 'A rope.'].join('\n'),
  ),
  chapter(
    '02-act-two',
    2,
    ['# Act Two', '', '## 3', '', 'A well.', '', '## 4', '', 'An end.'].join('\n'),
  ),
];

describe('bookUnits', () => {
  it('gathers every section in the book, in reading order', () => {
    expect(bookUnits(acts, 2).all.map((unit) => unit.id)).toEqual(['1', '2', '3', '4']);
  });

  /**
   * The point of the index. A choice says `to="3"` and never says which file
   * holds it, so something has to know — and it cannot be the route, because
   * the author must be free to move section 3 into another act tomorrow.
   */
  it('remembers which file each section was written in', () => {
    const { chapterOf } = bookUnits(acts, 2);

    expect(chapterOf.get('2')?.slug).toBe('01-act-one');
    expect(chapterOf.get('3')?.slug).toBe('02-act-two');
  });

  it('has nothing to index when the file is the page', () => {
    expect(bookUnits(acts, undefined).all).toEqual([]);
  });

  /**
   * Ids are slugged one file at a time, so nothing in the engine stops two
   * acts both opening a `## 1`. The reader is forgiving and keeps the first,
   * because someone mid-journey is owed a page; refusing the book is the
   * linter's job.
   */
  it('keeps the first of two sections that claim the same number', () => {
    const clashing = [
      acts[0],
      chapter('02-act-two', 2, ['# Act Two', '', '## 1', '', 'A copy.'].join('\n')),
    ];
    const { all, chapterOf } = bookUnits(clashing, 2);

    expect(all.map((unit) => unit.id)).toEqual(['1', '2']);
    expect(chapterOf.get('1')?.slug).toBe('01-act-one');
  });
});
