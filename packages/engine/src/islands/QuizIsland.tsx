import { useMemo, useState } from 'react';
import type { IslandComponentProps, QuizQuestion } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { scores } from '../store/store';
import { useBook } from '../reader/BookContext';
import { attrText } from './attributes';
import { fitsQuiz, quizOrder, type QuizOrder, type Shuffle } from './quizOrder';

interface QuizProgress {
  submitted: boolean;
  /** Indexed by **authored** question, holding **authored** option indices. */
  selections: number[][];
  /**
   * How this attempt is arranged. Stored so a reload does not deal a new hand
   * mid-attempt; regenerated on retry, which is where a fresh one is the point.
   */
  order?: QuizOrder;
}

/**
 * Interactive multiple-choice quiz. Reads pre-parsed questions from `data`,
 * scores the reader's answers, and persists the best result locally.
 */
export function QuizIsland({ id, attributes, data }: IslandComponentProps) {
  const { slug } = useBook();
  const questions = useMemo<QuizQuestion[]>(
    () => (Array.isArray(data) ? (data as QuizQuestion[]) : []),
    [data],
  );
  const shuffle = attrText(attributes.shuffle, 'none') as Shuffle;
  const storageKey = `quiz:${id}`;
  const [state, setState, loaded] = usePersistentState<QuizProgress>(storageKey, {
    submitted: false,
    selections: questions.map(() => []),
  });
  const [attempts, setAttempts] = useState(0);
  // Distinct from `attempts`, which is the number recorded against the score:
  // asking for a new hand is not an attempt at the quiz.
  const [deal, setDeal] = useState(0);

  /*
   * Dealt here rather than written to the store on first render, which would be
   * a write during render for no gain: before the reader has answered anything
   * there is nothing a re-deal could disturb. It is persisted by the first
   * `setState` below, which is the moment it starts to matter.
   */
  const dealt = useMemo(
    () => quizOrder(questions, shuffle),
    // A fresh arrangement per attempt is the point, so `deal` belongs here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, shuffle, deal],
  );

  if (!loaded) {
    return <div className="island island--quiz island--loading" aria-busy="true" />;
  }

  const selections =
    state.selections.length === questions.length ? state.selections : questions.map(() => []);

  // A stored order wins, so reopening the page shows the hand the reader was
  // looking at. An edition that changed the questions invalidates it.
  const order = fitsQuiz(state.order, questions) ? state.order : dealt;

  function toggle(qIndex: number, oIndex: number) {
    if (state.submitted) return;
    const question = questions[qIndex];
    const chosen = new Set(selections[qIndex]);
    if (question.multi) {
      if (chosen.has(oIndex)) {
        chosen.delete(oIndex);
      } else {
        chosen.add(oIndex);
      }
    } else {
      chosen.clear();
      chosen.add(oIndex);
    }
    const next = selections.map((s, i) => (i === qIndex ? [...chosen].sort((a, b) => a - b) : s));
    setState({ ...state, selections: next, order });
  }

  function isCorrect(qIndex: number): boolean {
    const question = questions[qIndex];
    const correct = question.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    const chosen = [...selections[qIndex]].sort((a, b) => a - b);
    return correct.length === chosen.length && correct.every((v, i) => v === chosen[i]);
  }

  const score = questions.reduce((acc, _q, i) => acc + (isCorrect(i) ? 1 : 0), 0);

  function submit() {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setState({ ...state, submitted: true, order });
    void scores.record(slug, id, { score, total: questions.length, attempts: nextAttempts });
  }

  function retry() {
    // The stored order is dropped, and `deal` re-runs the memo, so the next
    // render arranges the quiz afresh.
    setDeal((n) => n + 1);
    setState({ submitted: false, selections: questions.map(() => []) });
  }

  return (
    <section className="island island--quiz" aria-label="Quiz">
      {/* Walked through the order, so `qi` and `oi` stay the authored indices
          everything else — selections, scoring, the radio group name — uses. */}
      {order.questions.map((qi) => {
        const q = questions[qi];
        return (
          <fieldset key={qi} className="quiz__question">
            <legend className="quiz__prompt">{q.prompt}</legend>
            {order.options[qi].map((oi) => {
              const o = q.options[oi];
              const checked = selections[qi].includes(oi);
              const showResult = state.submitted;
              const cls = [
                'quiz__option',
                checked ? 'is-selected' : '',
                showResult && o.correct ? 'is-correct' : '',
                showResult && checked && !o.correct ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <label key={oi} className={cls}>
                  <input
                    type={q.multi ? 'checkbox' : 'radio'}
                    name={`${id}-q${qi}`}
                    checked={checked}
                    disabled={state.submitted}
                    onChange={() => toggle(qi, oi)}
                  />
                  <span>{o.text}</span>
                </label>
              );
            })}
            {state.submitted && q.explanation && (
              <p className="quiz__explanation">{q.explanation}</p>
            )}
          </fieldset>
        );
      })}

      {!state.submitted ? (
        <button type="button" className="quiz__submit" onClick={submit}>
          Check answers
        </button>
      ) : (
        <div className="quiz__result" role="status">
          <strong>
            Score: {score} / {questions.length}
          </strong>
          <button type="button" className="quiz__retry" onClick={retry}>
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
