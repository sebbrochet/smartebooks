import { useMemo, useState } from 'react';
import type { IslandComponentProps } from '../types';
import { usePersistentState } from '../store/usePersistentState';

interface MatchConfig {
  pairs: [string, string][];
}

interface BestState {
  best: number | null;
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Match-the-pairs island. Pick a term on the left, then its match on the
 * right. Tracks the number of moves and persists the best (fewest) locally.
 * Pairs come from a JSON body parsed at parse time.
 */
export function MatchingPairsIsland({ id, data }: IslandComponentProps) {
  const pairs = useMemo<[string, string][]>(() => {
    const cfg = data as MatchConfig;
    return Array.isArray(cfg?.pairs) ? cfg.pairs : [];
  }, [data]);

  const lefts = useMemo(() => pairs.map((p, i) => ({ index: i, text: p[0] })), [pairs]);
  const [rights, setRights] = useState(() =>
    shuffle(pairs.map((p, i) => ({ index: i, text: p[1] }))),
  );

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [best, setBest] = usePersistentState<BestState>(`game:${id}`, { best: null });

  const solved = pairs.length > 0 && matched.size === pairs.length;

  function pickRight(rightIndex: number) {
    if (selectedLeft === null || matched.has(rightIndex) || solved) return;
    const total = moves + 1;
    setMoves(total);

    if (selectedLeft === rightIndex) {
      const next = new Set(matched);
      next.add(rightIndex);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === pairs.length && (best.best === null || total < best.best)) {
        setBest({ best: total });
      }
    } else {
      setWrong(rightIndex);
      window.setTimeout(() => setWrong(null), 400);
      setSelectedLeft(null);
    }
  }

  function reset() {
    setMatched(new Set());
    setSelectedLeft(null);
    setMoves(0);
    setWrong(null);
    setRights(shuffle(pairs.map((p, i) => ({ index: i, text: p[1] }))));
  }

  if (pairs.length === 0) {
    return (
      <div className="island game--matching island--unknown" role="note">
        This matching game has no pairs configured.
      </div>
    );
  }

  return (
    <div className="island game--matching">
      <div className="matching__columns">
        <ul className="matching__col">
          {lefts.map((l) => (
            <li key={l.index}>
              <button
                type="button"
                className={[
                  'matching__item',
                  matched.has(l.index) ? 'is-matched' : '',
                  selectedLeft === l.index ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={matched.has(l.index)}
                onClick={() => setSelectedLeft(l.index)}
              >
                {l.text}
              </button>
            </li>
          ))}
        </ul>
        <ul className="matching__col">
          {rights.map((r) => (
            <li key={r.index}>
              <button
                type="button"
                className={[
                  'matching__item',
                  matched.has(r.index) ? 'is-matched' : '',
                  wrong === r.index ? 'is-wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={matched.has(r.index)}
                onClick={() => pickRight(r.index)}
              >
                {r.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="matching__status" role="status">
        {solved ? (
          <span>
            Solved in {moves} moves! {best.best !== null && <em>Best: {best.best}</em>}
          </span>
        ) : (
          <span>Moves: {moves}</span>
        )}
        <button type="button" className="matching__reset" onClick={reset}>
          {solved ? 'Play again' : 'Reset'}
        </button>
      </div>
    </div>
  );
}
