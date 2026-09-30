// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import MoveList from './MoveList';
import { pgnToTree } from './tree';
import { formatEvaluation, describeEvaluation } from './evaluation';

/**
 * A game whose evaluation swings to **Black**. Deliberate: a fixture where
 * White is better cannot tell a White-relative value from a side-to-move one,
 * because the two agree on every White move. SPEC008 §4.21.
 */
const PGN = [
  '1. d4 { [%eval 0.15] } d5 { [%eval 0.2] }',
  '2. Nc3 { [%eval -0.02] } Nf6 { [%eval -1.3] }',
  '3. Bf4 { [%eval #-3] } e6',
].join(' ');

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

function render() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<MoveList tree={pgnToTree(PGN)} path="" onSelect={() => {}} />);
  });
  return host;
}

describe('formatEvaluation', () => {
  it('signs an advantage for White', () => {
    expect(formatEvaluation('0.54')).toBe('+0.54');
  });

  it('leaves a value already favouring Black alone', () => {
    expect(formatEvaluation('-1.3')).toBe('-1.3');
  });

  it('leaves a forced mate alone for either side', () => {
    expect(formatEvaluation('#5')).toBe('#5');
    expect(formatEvaluation('#-3')).toBe('#-3');
  });

  // The author's precision is the author's: rounding 0.54 to 0.5 would be this
  // code inventing a claim the book did not make.
  it('keeps the precision the annotator wrote', () => {
    expect(formatEvaluation('0.5')).toBe('+0.5');
    expect(formatEvaluation('0.54')).toBe('+0.54');
  });
});

describe('describeEvaluation', () => {
  it('names the side a number favours', () => {
    expect(describeEvaluation('0.54')).toBe('White is better');
    expect(describeEvaluation('-1.3')).toBe('Black is better');
  });

  it('names the side a mate belongs to', () => {
    expect(describeEvaluation('#5')).toBe('White mates');
    expect(describeEvaluation('#-3')).toBe('Black mates');
  });

  it('calls a dead level position level', () => {
    expect(describeEvaluation('0.0')).toBe('Level');
  });
});

describe('the move list shows stored evaluations', () => {
  it('prints one against every move that has one', () => {
    const shown = [...render().querySelectorAll('.chess-moves__eval')].map((el) => el.textContent);
    expect(shown).toEqual(['+0.15', '+0.2', '-0.02', '-1.3', '#-3']);
  });

  // The last move of the fixture carries no evaluation. Holding the previous
  // one would be the code asserting something about a position nobody assessed.
  it('shows nothing against a move the annotator did not assess', () => {
    const moves = [...render().querySelectorAll('.chess-moves__entry')];
    expect(moves).toHaveLength(6);
    expect(moves[5].querySelector('.chess-moves__eval')).toBeNull();
  });

  it('never prints the raw tag', () => {
    expect(render().textContent ?? '').not.toMatch(/\[%/);
  });
});
