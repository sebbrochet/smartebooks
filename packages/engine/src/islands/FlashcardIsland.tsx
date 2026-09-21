import { useState } from 'react';
import type { FlashcardData, IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { useMessages } from '../i18n/messages';

type Grade = 'again' | 'good' | 'easy';

const GRADES: Grade[] = ['again', 'good', 'easy'];

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
  const words = useMessages();

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
          {flipped ? words.flashcardBack : words.flashcardFront}
        </span>
      </button>
      {flipped && (
        <div className="flashcard__grades" role="group" aria-label={words.flashcardGrading}>
          {GRADES.map((value) => (
            <button key={value} type="button" onClick={() => grade(value)}>
              {words.flashcardGrade[value]}
            </button>
          ))}
        </div>
      )}
      {review.reps > 0 && <p className="flashcard__reps">{words.flashcardStreak(review.reps)}</p>}
    </div>
  );
}
