import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOARD_OPTIONS,
  orientationFor,
  pickEnum,
  resolveBoardOptions,
} from './boardOptions';

describe('pickEnum', () => {
  const allowed = ['a', 'b', 'c'] as const;

  it('returns the value when it is allowed', () => {
    expect(pickEnum('b', allowed, 'a')).toBe('b');
  });

  it('falls back for unknown or missing values', () => {
    expect(pickEnum('z', allowed, 'a')).toBe('a');
    expect(pickEnum(undefined, allowed, 'c')).toBe('c');
  });
});

describe('resolveBoardOptions', () => {
  it('uses built-in defaults when no attributes are given', () => {
    expect(resolveBoardOptions()).toEqual(DEFAULT_BOARD_OPTIONS);
  });

  it('applies valid per-directive attributes', () => {
    expect(resolveBoardOptions({ theme: 'blue', pieces: 'unicode', orientation: 'black' })).toEqual(
      {
        theme: 'blue',
        pieces: 'unicode',
        orientation: 'black',
      },
    );
  });

  it('ignores unknown values and keeps the default (untrusted-safe)', () => {
    expect(
      resolveBoardOptions({
        theme: 'evil"><script>',
        pieces: 'nope',
        orientation: 'sideways',
      }),
    ).toEqual(DEFAULT_BOARD_OPTIONS);
  });

  it('layers attributes over provided defaults', () => {
    const defaults = { theme: 'green', pieces: 'unicode', orientation: 'auto' } as const;
    // Only theme overridden; the rest inherit the caller default.
    expect(resolveBoardOptions({ theme: 'grey' }, defaults)).toEqual({
      theme: 'grey',
      pieces: 'unicode',
      orientation: 'auto',
    });
  });

  it("falls back to the book's defaults when a directive sets nothing", () => {
    const bookDefaults = { theme: 'blue', pieces: 'unicode', orientation: 'black' } as const;
    expect(resolveBoardOptions({}, bookDefaults)).toEqual(bookDefaults);
  });
});

describe('orientationFor', () => {
  const blackToMove = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 3';
  const whiteToMove = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('returns an explicit side unchanged, whatever the position says', () => {
    expect(orientationFor('white', blackToMove)).toBe('white');
    expect(orientationFor('black', whiteToMove)).toBe('black');
  });

  it('reads the side to move for auto', () => {
    expect(orientationFor('auto', blackToMove)).toBe('black');
    expect(orientationFor('auto', whiteToMove)).toBe('white');
  });

  // An orientation is a presentation choice, so a broken FEN must degrade to a
  // board rather than to an exception.
  it('shows White for a missing or malformed position', () => {
    expect(orientationFor('auto', undefined)).toBe('white');
    expect(orientationFor('auto', '')).toBe('white');
    expect(orientationFor('auto', 'not a fen')).toBe('white');
    expect(orientationFor(undefined, undefined)).toBe('white');
  });
});
