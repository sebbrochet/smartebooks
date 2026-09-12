import { describe, it, expect } from 'vitest';
import { formatTime, markAt, parseMarks, parseTime, positionOf } from './timedMedia';

/**
 * The mapping from a continuous clock to the author's discrete marks is the
 * whole of SPEC012's technical risk, so it is tested here rather than through a
 * player: it is pure, and the interesting cases are the boundaries.
 */
describe('parseTime', () => {
  it.each([
    ['0', 0],
    ['84', 84],
    ['0:00', 0],
    ['1:24', 84],
    ['10:00', 600],
    ['90:00', 5400], // The first group is unbounded: ninety minutes is a time.
    ['1:02:03', 3723],
    ['  1:24  ', 84],
  ])('reads %j as %i seconds', (text, seconds) => {
    expect(parseTime(text)).toBe(seconds);
  });

  /*
   * Refused rather than guessed at. `1:5` is the dangerous one — read as 65 it
   * would be plausible, and wrong, and silent.
   */
  it.each([
    '',
    '1:5',
    '1:75',
    '1:60',
    '0:00:60',
    '1:2:3',
    'abc',
    '1.24',
    '-1',
    '1:',
    ':24',
    '1:24:',
  ])('refuses %j', (text) => {
    expect(parseTime(text)).toBeUndefined();
  });
});

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [84, '1:24'],
    [600, '10:00'],
    [3723, '1:02:03'],
    [3600, '1:00:00'],
  ])('writes %i as %j', (seconds, text) => {
    expect(formatTime(seconds)).toBe(text);
  });

  it('floors a fractional clock rather than rounding it up past a mark', () => {
    expect(formatTime(84.9)).toBe('1:24');
  });

  it('round-trips every form parseTime accepts', () => {
    for (const seconds of [0, 1, 59, 60, 84, 599, 3599, 3600, 3723]) {
      expect(parseTime(formatTime(seconds))).toBe(seconds);
    }
  });
});

describe('parseMarks', () => {
  it('reads a time and the rest of the line as its label', () => {
    expect(parseMarks('0:00  Where it begins\n1:24  The bishop commits')).toEqual([
      { at: 0, label: 'Where it begins' },
      { at: 84, label: 'The bishop commits' },
    ]);
  });

  it('sorts by time, whatever order they were written in', () => {
    const marks = parseMarks('1:24 Later\n0:05 Earlier');
    expect(marks.map((mark) => mark.at)).toEqual([5, 84]);
  });

  it('labels an unlabelled mark with its own time', () => {
    expect(parseMarks('2:05')).toEqual([{ at: 125, label: '2:05' }]);
  });

  it('skips blank lines and lines with no readable time', () => {
    expect(parseMarks('\n  \n1:24 Fine\nnot a mark at all\n')).toEqual([{ at: 84, label: 'Fine' }]);
  });

  /*
   * Two labels for one moment would make `positions` ambiguous — `indexOf`
   * would find the first and `step` would never reach the second.
   */
  it('keeps the first of two marks at the same moment', () => {
    expect(parseMarks('1:24 First\n84 Second')).toEqual([{ at: 84, label: 'First' }]);
  });
});

describe('markAt', () => {
  const marks = parseMarks('0:10 One\n0:20 Two\n0:30 Three');

  it('is undefined before the first mark, which is a real place', () => {
    expect(markAt(marks, 0)).toBeUndefined();
    expect(markAt(marks, 9.9)).toBeUndefined();
    expect(positionOf(markAt(marks, 0))).toBe('');
  });

  it('takes the mark exactly on the boundary', () => {
    expect(markAt(marks, 10)?.label).toBe('One');
    expect(markAt(marks, 20)?.label).toBe('Two');
  });

  it('holds a mark until the next one arrives', () => {
    expect(markAt(marks, 10.001)?.label).toBe('One');
    expect(markAt(marks, 19.999)?.label).toBe('One');
  });

  it('stays on the last mark for the rest of the recording', () => {
    expect(markAt(marks, 30)?.label).toBe('Three');
    expect(markAt(marks, 9999)?.label).toBe('Three');
  });

  it('has nothing to say about a recording with no marks', () => {
    expect(markAt([], 42)).toBeUndefined();
  });
});
