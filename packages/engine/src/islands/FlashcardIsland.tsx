import { useState } from 'react';
import type { FlashcardData, IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';

type Grade = 'again' | 'good' | 'easy';

interface ReviewState {
  reps: number;
  lastGrade?: Grade;
  at?: number;
}

/**
 * A flip flashcard with a light spaced-repetition streak. Front/back come from
 * the parsed directive `data`; the review streak persists locally.
 */
export function FlashcardIsland({ id, data }: IslandComponentProps) {
  const card = (data ?? { front: '', back: '' }) as FlashcardData;
  const [flipped, setFlipped] = useState(false);
  const [review, setReview] = usePersistentState<ReviewState>(`review:${id}`, { reps: 0 });

  function grade(g: Grade) {
    setReview({
      reps: g === 'again' ? 0 : review.reps + 1,
      lastGrade: g,
      at: Date.now(),
    });
    setFlipped(false);
  }

  return (
    <div className="island island--flashcard">
      <button
        type="button"
        className="flashcard__card"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
      >
        <span className="flashcard__side">{flipped ? card.back : card.front}</span>
        <span className="flashcard__hint">
          {flipped ? 'Back — tap to flip back' : 'Front — tap to reveal'}
        </span>
      </button>
      {flipped && (
        <div className="flashcard__grades" role="group" aria-label="How well did you know it?">
          <button type="button" onClick={() => grade('again')}>
            Again
          </button>
          <button type="button" onClick={() => grade('good')}>
            Good
          </button>
          <button type="button" onClick={() => grade('easy')}>
            Easy
          </button>
        </div>
      )}
      {review.reps > 0 && <p className="flashcard__reps">Review streak: {review.reps}</p>}
    </div>
  );
}
