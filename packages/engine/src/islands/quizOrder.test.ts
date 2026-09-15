import { describe, it, expect } from 'vitest';
import { fitsQuiz, quizOrder, type QuizOrder } from './quizOrder';
import type { QuizQuestion } from '../types';

const question = (prompt: string, options: number): QuizQuestion => ({
  prompt,
  multi: false,
  options: Array.from({ length: options }, (_, i) => ({
    text: `${prompt}-${i}`,
    correct: i === 0,
  })),
});

const quiz = [question('a', 3), question('b', 4), question('c', 2)];

/** A deterministic "random" so a shuffle can be asserted rather than sampled. */
const cycling = (values: number[]) => {
  let at = 0;
  return () => values[at++ % values.length];
};

describe('quizOrder', () => {
  it('leaves everything where the author put it by default', () => {
    const order = quizOrder(quiz, 'none');

    expect(order.questions).toEqual([0, 1, 2]);
    expect(order.options).toEqual([
      [0, 1, 2],
      [0, 1, 2, 3],
      [0, 1],
    ]);
  });

  it('moves only what it was asked to move', () => {
    const questionsOnly = quizOrder(quiz, 'questions', cycling([0]));
    expect(questionsOnly.options).toEqual([
      [0, 1, 2],
      [0, 1, 2, 3],
      [0, 1],
    ]);

    const optionsOnly = quizOrder(quiz, 'options', cycling([0]));
    expect(optionsOnly.questions).toEqual([0, 1, 2]);
  });

  // Every index exactly once: a shuffle that dropped or duplicated one would
  // hide or double an option, which no reader could make sense of.
  it('is a permutation, never a sample', () => {
    const order = quizOrder(quiz, 'both', Math.random);

    expect([...order.questions].sort()).toEqual([0, 1, 2]);
    order.options.forEach((row, index) => {
      expect([...row].sort((a, b) => a - b)).toEqual(
        quiz[index].options.map((_, optionIndex) => optionIndex),
      );
    });
  });

  it('actually rearranges when asked', () => {
    // `random()` returning ~0 always swaps with the first slot, which reverses
    // nothing and moves everything — enough to prove the deck was cut.
    expect(quizOrder(quiz, 'questions', cycling([0])).questions).not.toEqual([0, 1, 2]);
  });
});

describe('fitsQuiz', () => {
  const order: QuizOrder = {
    questions: [2, 0, 1],
    options: [
      [0, 1, 2],
      [3, 2, 1, 0],
      [1, 0],
    ],
  };

  it('accepts an order that still describes the quiz', () => {
    expect(fitsQuiz(order, quiz)).toBe(true);
  });

  it('has nothing to honour when none was stored', () => {
    expect(fitsQuiz(undefined, quiz)).toBe(false);
  });

  /**
   * A corrected edition may add a question or an option. The stored order then
   * describes a book that no longer exists, and honouring it would hide the new
   * material or index past the end.
   */
  it('refuses an order from a different edition of the quiz', () => {
    expect(fitsQuiz(order, [...quiz, question('d', 2)])).toBe(false);
    expect(fitsQuiz(order, [question('a', 3), question('b', 5), question('c', 2)])).toBe(false);
  });
});
