import { describe, it, expect } from 'vitest';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { chapterScorables, bookTotals } from './scorables';
import type { Book } from '../types';

const registry = createIslandRegistry(defaultIslands);

const quiz = (id: string, questions: number) =>
  [
    `:::quiz{id="${id}"}`,
    ...Array.from({ length: questions }, (_, i) => [
      ``,
      `### Question ${i + 1}?`,
      ``,
      `- [x] Yes`,
      `- [ ] No`,
    ]).flat(),
    ``,
    `:::`,
    ``,
  ].join('\n');

describe('chapterScorables', () => {
  /**
   * The denominator is the point of this: a chapter can say "0 of 12" before
   * anything is attempted, which counting quizzes alone cannot express.
   */
  it('values a quiz at one point per question', () => {
    const found = chapterScorables(`# Chapter\n\n${quiz('a', 3)}`, registry);
    expect(found).toEqual([{ kind: 'quiz', id: 'a', points: 3 }]);
  });

  it('finds every quiz and checkpoint, in document order', () => {
    const markdown = [
      '# Chapter',
      '',
      quiz('first', 2),
      ':::checkpoint{id="done" label="Finished"}',
      ':::',
      '',
      quiz('second', 1),
    ].join('\n');

    expect(chapterScorables(markdown, registry)).toEqual([
      { kind: 'quiz', id: 'first', points: 2 },
      { kind: 'checkpoint', id: 'done', points: 1 },
      { kind: 'quiz', id: 'second', points: 1 },
    ]);
  });

  /**
   * Without an id every instance writes to the same key, so a score could
   * never be attributed to this chapter. Counting it would inflate the
   * denominator against points the reader has no way to earn.
   */
  it('ignores a quiz with no id', () => {
    expect(
      chapterScorables(`# Chapter\n\n:::quiz\n\n### Q?\n\n- [x] Yes\n\n:::\n`, registry),
    ).toEqual([]);
  });

  it('ignores islands that score nothing, and directives the book never declared', () => {
    const markdown = [
      '# Chapter',
      '',
      ':::flashcard{id="card"}',
      '**Front:** A',
      '',
      '**Back:** B',
      ':::',
      '',
      ':::chess-board{id="board"}',
      ':::',
      '',
    ].join('\n');

    expect(chapterScorables(markdown, registry)).toEqual([]);
  });

  /**
   * Names resolve through the book's registry rather than a table copied into
   * this module, so a book still using an older spelling is counted rather
   * than quietly scoring zero.
   */
  it('counts an island under an alias the registry knows', () => {
    const aliased = createIslandRegistry([
      { ...defaultIslands.find((island) => island.name === 'quiz')!, aliases: ['selftest'] },
    ]);
    const markdown = `# Chapter\n\n:::selftest{id="a"}\n\n### Q?\n\n- [x] Yes\n- [ ] No\n\n:::\n`;

    expect(chapterScorables(markdown, aliased)).toEqual([{ kind: 'quiz', id: 'a', points: 1 }]);
  });
});

describe('whether a book measures the reader', () => {
  const book = (...markdown: string[]): Book =>
    ({
      meta: { slug: 'b', title: 'B' },
      chapters: markdown.map((text, i) => ({
        slug: `c${i}`,
        order: i,
        title: `C${i}`,
        markdown: text,
      })),
    }) as Book;

  it('is false for a book of prose', () => {
    // The novel. Three permanent zeros is what this stops.
    expect(bookTotals(book('# Chapitre premier\n\nIl entra.'), registry)).toEqual({
      sections: 0,
      points: 0,
    });
  });

  /*
   * The case the guard must not catch, and the reason it reads the content
   * rather than the store: a book full of quizzes shows `0/40` on the first
   * day. That zero is the reader's position, not an absence, and hiding it
   * would hide the thing they are about to move.
   */
  it('counts every question in the book, before anything has been answered', () => {
    expect(bookTotals(book('# Chapter\n\n' + quiz('a', 12)), registry)).toEqual({
      sections: 0,
      points: 12,
    });
  });

  it('is true for a book scored only by checkpoints', () => {
    expect(bookTotals(book('# Chapter\n\n::checkpoint{id="done"}\n'), registry)).toEqual({
      sections: 1,
      points: 0,
    });
  });

  it('looks past the first chapter', () => {
    // A study guide that opens with a preface would otherwise be told it has
    // nothing to measure.
    expect(bookTotals(book('# Preface\n\nWhy this book.', quiz('a', 1)), registry)).toEqual({
      sections: 0,
      points: 1,
    });
  });

  /*
   * The denominator must not depend on the reader. `readBookStats` totalled
   * only the quizzes already attempted, so it grew as they answered — which is
   * the one thing a denominator cannot do.
   */
  it('adds up across chapters, so the total is the whole book', () => {
    const shape = book(
      '# One\n\n' + quiz('a', 3) + '\n::checkpoint{id="c1"}\n',
      '# Two\n\n' + quiz('b', 5) + '\n::checkpoint{id="c2"}\n',
    );
    expect(bookTotals(shape, registry)).toEqual({ sections: 2, points: 8 });
  });
});
