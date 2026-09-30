// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import EvalBar from './EvalBar';
import { evaluationPercent } from './evaluation';
import { pgnToTree, hasEvaluations } from './tree';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

function render(evaluation: string | undefined, orientation: 'white' | 'black' = 'white') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<EvalBar evaluation={evaluation} orientation={orientation} />);
  });
  return host.querySelector('.chess-eval-bar') as HTMLElement;
}

const fill = (bar: HTMLElement) =>
  bar.querySelector('.chess-eval-bar__white') as HTMLElement | null;

describe('evaluationPercent', () => {
  it('puts a level position in the middle', () => {
    expect(evaluationPercent('0')).toBeCloseTo(50, 5);
  });

  it('gives White more of the bar as the number rises', () => {
    expect(evaluationPercent('1')).toBeGreaterThan(evaluationPercent('0.2'));
    expect(evaluationPercent('-1')).toBeLessThan(evaluationPercent('-0.2'));
  });

  /**
   * The reason for a sigmoid rather than a linear clamp: the range a reader can
   * act on is the first couple of pawns, and a linear scale spends almost none
   * of the bar on it.
   */
  it('spends more of the bar on small advantages than on large ones', () => {
    const early = evaluationPercent('1') - evaluationPercent('0');
    const late = evaluationPercent('9') - evaluationPercent('8');
    expect(early).toBeGreaterThan(late * 5);
  });

  it('never empties the bar for a side that is merely winning', () => {
    expect(evaluationPercent('99')).toBeLessThanOrEqual(99);
    expect(evaluationPercent('-99')).toBeGreaterThanOrEqual(1);
  });

  it('pins a forced mate to the end that owns it', () => {
    expect(evaluationPercent('#1')).toBe(100);
    expect(evaluationPercent('#-1')).toBe(0);
  });
});

describe('the evaluation bar', () => {
  it('fills most of the bar when White is winning', () => {
    const bar = render('3');
    expect(Number(fill(bar)?.dataset.percent)).toBeGreaterThan(80);
  });

  it('fills little of it when Black is winning', () => {
    const bar = render('-3');
    expect(Number(fill(bar)?.dataset.percent)).toBeLessThan(20);
  });

  // The bar means "White's share", and White is at the bottom only while the
  // board is drawn for White. Swapping the colours is what keeps that true
  // without the number changing.
  it('swaps the colours rather than the value when the board is flipped', () => {
    expect(render('3', 'white').className).not.toMatch(/is-flipped/);
    const flipped = render('3', 'black');
    expect(flipped.className).toMatch(/is-flipped/);
    expect(Number(fill(flipped)?.dataset.percent)).toBeGreaterThan(80);
  });

  /**
   * E4, and the reason it needed deciding rather than defaulting. An empty bar
   * is already what mate-for-Black looks like, so "nobody assessed this" cannot
   * be drawn as one — and holding the previous value would put a claim on
   * screen that the annotator never made.
   */
  it('draws an unassessed position as neither side, and not as an empty bar', () => {
    const unknown = render(undefined);
    expect(unknown.className).toMatch(/is-unknown/);
    expect(fill(unknown)).toBeNull();

    const mateForBlack = render('#-1');
    expect(mateForBlack.className).not.toMatch(/is-unknown/);
    expect(fill(mateForBlack)).not.toBeNull();
  });

  it('says which side is better, for a reader who cannot see the bar', () => {
    expect(render('1.2').getAttribute('aria-label')).toBe('Evaluation +1.2. White is better.');
    expect(render(undefined).getAttribute('aria-label')).toBe('This position was not assessed.');
  });
});

/**
 * The bar is conditional on the *game*, not on the move: it must not appear and
 * vanish as the reader steps past a position nobody assessed.
 */
describe('whether a game has anything to show', () => {
  it('is false for a game with no evaluations at all', () => {
    expect(hasEvaluations(pgnToTree('1. e4 e5 {A reply.} 2. Nf3'))).toBe(false);
  });

  it('is true when only one move carries one', () => {
    expect(hasEvaluations(pgnToTree('1. e4 e5 2. Nf3 {[%eval 0.2]}'))).toBe(true);
  });

  // An annotator may assess only the lines they thought worth arguing about.
  it('is true when only a sideline carries one', () => {
    expect(hasEvaluations(pgnToTree('1. e4 e5 (1... c5 {[%eval 0.3]}) 2. Nf3'))).toBe(true);
  });
});
