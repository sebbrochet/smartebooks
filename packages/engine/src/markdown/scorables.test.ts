import { describe, it, expect } from 'vitest';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { chapterScorables } from './scorables';

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
