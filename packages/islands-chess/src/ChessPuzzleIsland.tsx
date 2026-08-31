import { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { attrText, usePersistentState, type IslandComponentProps } from '@smart-ebooks/engine';
import { DEFAULT_BOARD_OPTIONS, orientationFor, type BoardOptions } from './boardOptions';
import { play, playSan, positionFrom, sameMove, solutionMoves } from './puzzle';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './chess.css';
import './themes.css';

type Verdict = 'unanswered' | 'right' | 'wrong';

/**
 * A chess puzzle (SPEC008 G3.3).
 *
 * With a `solution`, the reader **plays** the move and the island checks it —
 * the natural chess analogue of `quiz`, and the difference between a book that
 * tests and one that tells. A solution line is followed: the island plays the
 * opponent's replies so the reader answers each of their own moves in turn.
 *
 * Without one it stays the older "think, then reveal" puzzle, so existing
 * content keeps working and an author who has only prose to offer is not
 * forced to invent notation.
 *
 * Shares the board's `theme`/`pieces`/`orientation` config; with the default
 * `orientation=auto` the position is shown from the side that has to find the
 * move, which is how a puzzle book prints it.
 */
export default function ChessPuzzleIsland({ attributes, id, data }: IslandComponentProps) {
  const {
    fen: start,
    solution,
    board = DEFAULT_BOARD_OPTIONS,
  } = (data as { fen?: string; solution?: string; board?: BoardOptions }) ?? {};
  const { theme, pieces, orientation } = board;
  const hint = attrText(attributes.hint);
  const expected = solutionMoves(attrText(attributes.solution));
  const interactive = expected.length > 0 && start !== undefined;

  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>('unanswered');
  // Bumped after every refused move. Chessground clears `movable.dests` once a
  // user move is made, so putting the position back is not enough — without a
  // rebuild the board silently stops accepting moves, and the reader is left
  // looking at a puzzle that no longer responds.
  const [attempt, setAttempt] = useState(0);
  // How far into the solution line the reader has got, and the position there.
  const [step, setStep] = useState(0);
  const [fen, setFen] = useState(start ?? '');
  const [state, setState] = usePersistentState<{ solved: boolean }>(`chesspuzzle:${id}`, {
    solved: false,
  });

  const side = orientationFor(orientation, start);
  const position = positionFrom(fen);

  // A ref, because the Chessground move handler is bound once per position and
  // would otherwise close over a stale step.
  const answer = useRef<(orig: string, dest: string) => void>(() => {});
  answer.current = (orig, dest) => {
    const played = play(fen, orig, dest);
    if (!played.san || !played.fen) return;

    if (!sameMove(played.san, expected[step])) {
      setVerdict('wrong');
      // Put the piece back: a puzzle is a question, and a wrong answer should
      // leave the reader looking at the same question.
      setAttempt((count) => count + 1);
      return;
    }

    const reply = expected[step + 1];
    const after = reply ? playSan(played.fen, reply) : undefined;
    setVerdict('right');
    setStep(step + (reply ? 2 : 1));
    setFen(after ?? played.fen);

    if (step + (reply ? 2 : 1) >= expected.length) {
      setState({ solved: true });
      setRevealed(true);
    }
  };

  useEffect(() => {
    if (!boardRef.current || !fen) return;
    const solved = state.solved;
    const playable = interactive && !solved && position !== undefined;
    // `movable` is spread in rather than passed as `undefined`, because
    // Chessground deep-merges its config and an explicit `undefined` *replaces*
    // the default instead of leaving it alone — which then throws inside the
    // library, out of reach of anything that could explain it.
    const api = Chessground(boardRef.current, {
      viewOnly: !playable,
      coordinates: true,
      fen,
      orientation: side,
      ...(playable
        ? {
            movable: {
              free: false,
              color: position?.turn,
              dests: position?.dests,
              events: { after: (orig, dest) => answer.current(orig, dest) },
            },
          }
        : {}),
    });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // `position` is derived from `fen`; listing it would rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, side, interactive, state.solved, attempt]);

  if (!start) {
    return (
      <div className="island island--unknown" role="note">
        Puzzle is missing a <code>fen</code>.
      </div>
    );
  }

  const done = state.solved;

  return (
    <div
      className={`island chessboard-island ${done ? 'is-solved' : ''}`}
      data-testid="chess-puzzle"
    >
      <div
        className={`chessboard-island__board cg-wrap cg-theme--${theme} cg-pieces--${pieces}`}
        ref={boardRef}
        aria-label={interactive ? 'Chess puzzle — play the move' : 'Chess puzzle'}
      />

      <div className="chessboard-island__controls">
        {hint && !showHint && !done && (
          <button type="button" onClick={() => setShowHint(true)}>
            Hint
          </button>
        )}
        {(!interactive || done) && (
          <button type="button" onClick={() => setRevealed((value) => !value)}>
            {revealed ? 'Hide solution' : 'Reveal solution'}
          </button>
        )}
        {interactive ? (
          // No self-marking checkbox: the island knows.
          <span className="chesspuzzle__state" data-testid="chess-puzzle-state" role="status">
            {done
              ? 'Solved'
              : verdict === 'wrong'
                ? 'Not that one — try again.'
                : verdict === 'right'
                  ? 'Right. Keep going.'
                  : 'Your move.'}
          </span>
        ) : (
          <label className="chesspuzzle__solved">
            <input
              type="checkbox"
              checked={done}
              onChange={(event) => setState({ solved: event.target.checked })}
            />{' '}
            Solved
          </label>
        )}
      </div>

      {showHint && !done && <p className="chesspuzzle__hint">{hint}</p>}
      {revealed && solution && <p className="chesspuzzle__solution">{solution}</p>}
    </div>
  );
}
