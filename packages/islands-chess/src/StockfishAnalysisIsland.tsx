import { attrNumber, attrText, type IslandComponentProps } from '@smart-ebooks/engine';
import PositionAnalysis from './PositionAnalysis';

/**
 * On-demand Stockfish analysis of a fixed position (`fen`). The engine work
 * lives in the shared {@link PositionAnalysis} component, which the board
 * island also embeds to analyze its live position.
 *
 * `eval` / `best` let the author state the evaluation up front. That is not
 * redundant with the engine: a stated evaluation is the only form that survives
 * export, print and a reader with no JavaScript, and it is what an annotated
 * PGN already carries.
 */
export default function StockfishAnalysisIsland({ attributes }: IslandComponentProps) {
  const fen = attrText(attributes.fen);

  if (!fen) {
    return (
      <div className="island island--unknown" role="note">
        Analysis is missing a <code>fen</code>.
      </div>
    );
  }

  return (
    <div className="island island--chess-analysis">
      <PositionAnalysis
        fen={fen}
        depth={attrNumber(attributes.depth, 14)}
        stated={attrText(attributes.eval) || undefined}
        statedBest={attrText(attributes.best) || undefined}
      />
    </div>
  );
}
