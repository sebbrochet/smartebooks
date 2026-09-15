import type { QuizQuestion } from '../types';

/**
 * Whether a quiz varies its arrangement between attempts (SPEC001 P2.13).
 *
 * Re-running a quiz that asks the same questions in the same order, with the
 * same options in the same places, trains recall of *position* rather than of
 * the material — which is the opposite of what a revision aid is for.
 *
 * Off by default, because order is sometimes load-bearing: a teaching set may
 * build question by question, and an option may refer to its neighbours ("both
 * of the above"). Only the author knows, so only the author may ask.
 */
export type Shuffle = 'none' | 'questions' | 'options' | 'both';

export const SHUFFLES: Shuffle[] = ['none', 'questions', 'options', 'both'];

/**
 * The arrangement to show a quiz in: **presentation only**.
 *
 * `questions` and each row of `options` are indices into what the author wrote,
 * and answers are stored against those authored indices rather than against
 * screen positions. That is the whole reason this is safe: losing, changing or
 * regenerating an order can move things around, and can never turn a reader's
 * recorded answer into a different one.
 */
export interface QuizOrder {
  questions: number[];
  /** Indexed by **authored** question, not by display position. */
  options: number[][];
}

function shuffled(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);

  // Fisher–Yates: every permutation equally likely, which the naive
  // `sort(() => random() - 0.5)` is not.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function quizOrder(
  questions: QuizQuestion[],
  shuffle: Shuffle,
  random: () => number = Math.random,
): QuizOrder {
  const moveQuestions = shuffle === 'questions' || shuffle === 'both';
  const moveOptions = shuffle === 'options' || shuffle === 'both';

  return {
    questions: moveQuestions
      ? shuffled(questions.length, random)
      : questions.map((_, index) => index),
    options: questions.map((question) =>
      moveOptions
        ? shuffled(question.options.length, random)
        : question.options.map((_, index) => index),
    ),
  };
}

/** Whether a stored order still describes this quiz, after an edition changed it. */
export function fitsQuiz(
  order: QuizOrder | undefined,
  questions: QuizQuestion[],
): order is QuizOrder {
  return (
    order !== undefined &&
    order.questions.length === questions.length &&
    order.options.length === questions.length &&
    order.options.every((row, index) => row.length === questions[index].options.length)
  );
}
