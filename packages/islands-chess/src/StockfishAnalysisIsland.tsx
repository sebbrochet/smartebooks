import type { IslandComponentProps } from '@smart-ebooks/engine';
import PositionAnalysis from './PositionAnalysis';

/**
 * Standalone on-demand Stockfish analysis of a fixed position (`fen`). The
 * engine work lives in the shared {@link PositionAnalysis} component, which the
 * board island also embeds to analyze its live position.
 */
export default function StockfishAnalysisIsland({ attributes }: IslandComponentProps) {
  const fen = attributes.fen ?? '';

  if (!fen) {
    return (
      <div className="island island--unknown" role="note">
        Analysis is missing a <code>fen</code>.
      </div>
    );
  }

  return (
    <div className="island">
      <PositionAnalysis fen={fen} />
    </div>
  );
}
