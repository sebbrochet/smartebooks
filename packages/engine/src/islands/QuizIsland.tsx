import { useMemo, useState } from 'react';
import type { IslandComponentProps, QuizQuestion } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { scores } from '../store/store';
import { useBook } from '../reader/BookContext';

interface QuizProgress {
  submitted: boolean;
  selections: number[][];
}

/**
 * Interactive multiple-choice quiz. Reads pre-parsed questions from `data`,
 * scores the reader's answers, and persists the best result locally.
 */
export function QuizIsland({ id, data }: IslandComponentProps) {
  const { slug } = useBook();
  const questions = useMemo<QuizQuestion[]>(
    () => (Array.isArray(data) ? (data as QuizQuestion[]) : []),
    [data],
  );
  const storageKey = `quiz:${id}`;
  const [state, setState, loaded] = usePersistentState<QuizProgress>(storageKey, {
    submitted: false,
    selections: questions.map(() => []),
  });
  const [attempts, setAttempts] = useState(0);

  if (!loaded) {
    return <div className="island island--quiz island--loading" aria-busy="true" />;
  }

  const selections =
    state.selections.length === questions.length ? state.selections : questions.map(() => []);

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
    setState({ ...state, selections: next });
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
    setState({ ...state, submitted: true });
    void scores.record(slug, id, { score, total: questions.length, attempts: nextAttempts });
  }

  function retry() {
    setState({ submitted: false, selections: questions.map(() => []) });
  }

  return (
    <section className="island island--quiz" aria-label="Quiz">
      {questions.map((q, qi) => (
        <fieldset key={qi} className="quiz__question">
          <legend className="quiz__prompt">{q.prompt}</legend>
          {q.options.map((o, oi) => {
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
          {state.submitted && q.explanation && <p className="quiz__explanation">{q.explanation}</p>}
        </fieldset>
      ))}

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
