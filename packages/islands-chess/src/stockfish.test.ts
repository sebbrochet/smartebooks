import { describe, it, expect } from 'vitest';
import { parseInfoLine, parseBestMove } from './stockfish';

describe('parseInfoLine', () => {
  it('parses depth, centipawn score, and pv', () => {
    const info = parseInfoLine('info depth 12 seldepth 18 score cp 34 nodes 1 pv e2e4 e7e5 g1f3');
    expect(info).toEqual({ depth: 12, scoreCp: 34, pv: ['e2e4', 'e7e5', 'g1f3'] });
  });

  it('parses mate scores', () => {
    const info = parseInfoLine('info depth 20 score mate 3 pv a1a8');
    expect(info?.mateIn).toBe(3);
  });

  it('ignores non-score, secondary, and bound lines', () => {
    expect(parseInfoLine('info depth 1 nodes 20')).toBeNull();
    expect(parseInfoLine('info depth 10 multipv 2 score cp 5 pv a2a3')).toBeNull();
    expect(parseInfoLine('info depth 10 score cp 5 upperbound pv a2a3')).toBeNull();
    expect(parseInfoLine('bestmove e2e4')).toBeNull();
  });
});

describe('parseBestMove', () => {
  it('extracts the best move', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
  });

  it('returns null for none / non-bestmove lines', () => {
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeNull();
  });
});
