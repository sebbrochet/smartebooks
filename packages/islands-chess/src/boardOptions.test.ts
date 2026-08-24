import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_OPTIONS, pickEnum, resolveBoardOptions } from './boardOptions';

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
    expect(resolveBoardOptions({ theme: 'blue', pieces: 'unicode' })).toEqual({
      theme: 'blue',
      pieces: 'unicode',
    });
  });

  it('ignores unknown values and keeps the default (untrusted-safe)', () => {
    expect(resolveBoardOptions({ theme: 'evil"><script>', pieces: 'nope' })).toEqual(
      DEFAULT_BOARD_OPTIONS,
    );
  });

  it('layers attributes over provided defaults', () => {
    const defaults = { theme: 'green', pieces: 'unicode' } as const;
    // Only theme overridden; pieces inherits the caller default.
    expect(resolveBoardOptions({ theme: 'grey' }, defaults)).toEqual({
      theme: 'grey',
      pieces: 'unicode',
    });
  });

  it("falls back to the book's defaults when a directive sets nothing", () => {
    const bookDefaults = { theme: 'blue', pieces: 'unicode' } as const;
    expect(resolveBoardOptions({}, bookDefaults)).toEqual(bookDefaults);
  });
});
