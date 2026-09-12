import { useMediaLesson, useSequence } from './mediaContext';
import { formatTime } from './timedMedia';
import './timedMedia.css';

/**
 * The timecoded index, placed where the author wants it (SPEC012 §4.3).
 *
 * The counterpart of `::chess-moves`: the container owns the marks, and this
 * shows them. Separate from the container for the same reason the score is —
 * a book may want the index at the top, at the bottom, or not at all.
 *
 * This is also the island's static form made visible. Strip the interactivity
 * and a timecoded index is exactly how books about recordings have always been
 * written, which is the strongest fallback story in the catalogue after
 * gamebooks (SPEC001 P1.1).
 */
export default function MediaMarksIsland() {
  const lesson = useMediaLesson();
  const sequence = useSequence();

  if (!lesson || !sequence) {
    return (
      <div className="island island--unknown" role="note">
        <code>::media-marks</code> has to be inside a <code>:::media-lesson</code>.
      </div>
    );
  }

  if (lesson.marks.length === 0) {
    return (
      <div className="island island--unknown" role="note">
        This lesson has no marks to show.
      </div>
    );
  }

  return (
    <nav className="island media-marks" aria-label="Moments in this recording">
      <ol className="media-marks__list">
        {lesson.marks.map((mark) => {
          const position = String(mark.at);
          const current = sequence.current === position;

          return (
            <li key={position} className="media-marks__item">
              <button
                type="button"
                className={current ? 'media-marks__mark is-current' : 'media-marks__mark'}
                aria-current={current ? 'true' : undefined}
                onClick={() => sequence.go(position)}
              >
                <span className="media-marks__time">{formatTime(mark.at)}</span>
                <span className="media-marks__label">{mark.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
