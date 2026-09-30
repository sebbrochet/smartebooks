import { describeEvaluation, evaluationPercent, formatEvaluation } from './evaluation';

export interface EvalBarProps {
  /** Stored `[%eval]` for the position on the board, White-relative. */
  evaluation?: string;
  /** Which side the board is drawn for. */
  orientation: 'white' | 'black';
}

/**
 * The evaluation beside the board, as a bar (SPEC008 G10.5).
 *
 * Shown only for a game that states evaluations somewhere, and only for the
 * positions it states them for. **A position the annotator did not assess gets
 * its own look, not a guess**: holding the previous value would put a claim on
 * screen that nobody made, and falling back to level would say "equal" about a
 * position nobody judged. Sidelines routinely carry none in a game whose main
 * line does, so this is the common case rather than an edge.
 *
 * "No assessment" cannot be drawn as an empty bar, because an empty bar is
 * already what a forced mate for Black looks like. It gets a flat muted track
 * instead, which is neither end.
 *
 * Flipping swaps the two colours rather than rotating: the bar means "White's
 * share", and White's share is at the bottom only while White is at the bottom.
 */
export default function EvalBar({ evaluation, orientation }: EvalBarProps) {
  const known = evaluation !== undefined;
  const white = known ? evaluationPercent(evaluation) : 50;

  return (
    <div
      className={`chess-eval-bar${orientation === 'black' ? ' is-flipped' : ''}${
        known ? '' : ' is-unknown'
      }`}
      data-testid="chess-eval-bar"
      role="img"
      aria-label={
        known
          ? `Evaluation ${formatEvaluation(evaluation)}. ${describeEvaluation(evaluation)}.`
          : 'This position was not assessed.'
      }
      title={known ? formatEvaluation(evaluation) : undefined}
    >
      {known && (
        <div
          className="chess-eval-bar__white"
          style={{ height: `${white}%` }}
          data-percent={Math.round(white)}
        />
      )}
    </div>
  );
}
