import { useEffect, useRef, useState } from 'react';
import { StockfishEngine, getStockfishUrl, type InfoLine } from './stockfish';
import './chess.css';

type Status = 'idle' | 'thinking' | 'done' | 'error';

export interface PositionAnalysisProps {
  /** FEN of the position to analyze. */
  fen: string;
  /** Search depth. */
  depth?: number;
}

/**
 * On-demand Stockfish analysis of a single position. Loads the engine lazily on
 * the first "Analyze" click and disposes it on unmount. Resets whenever `fen`
 * changes, so a stale evaluation is never shown for a new position — this is
 * what lets a live board re-use it as the reader steps through moves.
 */
export default function PositionAnalysis({ fen, depth = 14 }: PositionAnalysisProps) {
  const engineRef = useRef<StockfishEngine | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [info, setInfo] = useState<InfoLine | null>(null);
  const [best, setBest] = useState<string | null>(null);

  // A new position invalidates any previous result.
  useEffect(() => {
    setStatus('idle');
    setInfo(null);
    setBest(null);
  }, [fen]);

  // Release the worker when the component goes away.
  useEffect(() => () => engineRef.current?.dispose(), []);

  const whiteToMove = fen.split(' ')[1] !== 'b';

  async function analyze() {
    setStatus('thinking');
    setInfo(null);
    setBest(null);
    try {
      engineRef.current ??= new StockfishEngine(getStockfishUrl());
      const result = await engineRef.current.analyze(fen, { depth, onInfo: setInfo });
      setInfo(result.info ?? null);
      setBest(result.bestMove);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  function evalText(value: InfoLine | null): string {
    if (!value) return '';
    if (value.mateIn != null) return `#${whiteToMove ? value.mateIn : -value.mateIn}`;
    if (value.scoreCp != null) {
      const cp = whiteToMove ? value.scoreCp : -value.scoreCp;
      return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`;
    }
    return '';
  }

  return (
    <div className="chess-analysis">
      <button type="button" onClick={analyze} disabled={status === 'thinking'}>
        {status === 'thinking' ? 'Analyzing…' : 'Analyze with Stockfish'}
      </button>

      {status === 'error' && (
        <p className="chess-analysis__msg" role="status">
          Engine unavailable.
        </p>
      )}

      {(status === 'thinking' || status === 'done') && info && (
        <div className="chess-analysis__result" data-testid="chess-eval" role="status">
          <strong>{evalText(info)}</strong>
          <span className="chess-analysis__depth"> depth {info.depth ?? 0}</span>
          {best && <span> · best {best}</span>}
          {info.pv && info.pv.length > 0 && (
            <div className="chess-analysis__pv">{info.pv.slice(0, 6).join(' ')}</div>
          )}
        </div>
      )}
    </div>
  );
}
