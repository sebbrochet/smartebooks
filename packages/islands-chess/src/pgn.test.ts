import { describe, it, expect } from 'vitest';
import { pgnToPlies } from './pgn';

describe('pgnToPlies', () => {
  it('replays a short mainline into FENs + SANs', () => {
    const { fens, sans } = pgnToPlies('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#');
    expect(sans).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
    // one more FEN than moves (starting position + after each ply)
    expect(fens).toHaveLength(sans.length + 1);
    expect(fens[0]).toContain('rnbqkbnr/pppppppp'); // standard start
  });

  it('returns empty results for junk input', () => {
    expect(pgnToPlies('not a pgn at all ~~~')).toEqual({ fens: expect.any(Array), sans: [] });
  });
});
