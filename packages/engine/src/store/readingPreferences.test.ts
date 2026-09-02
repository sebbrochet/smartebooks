// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_READING,
  READING_KEY,
  getReadingPreferences,
  setReadingPreferences,
} from './platformSettings';

beforeEach(() => localStorage.clear());

describe('reading preferences', () => {
  it('are the defaults until the reader chooses', () => {
    expect(getReadingPreferences()).toEqual(DEFAULT_READING);
  });

  it('round-trip', () => {
    const chosen = { size: 'large', leading: 'loose', measure: 'narrow', face: 'serif' } as const;
    setReadingPreferences(chosen);
    expect(getReadingPreferences()).toEqual(chosen);
  });

  /**
   * `localStorage` is writable by anything on the origin, and an unrecognised
   * value would become an attribute selector matching no rule — leaving the
   * reader with silently unstyled text rather than an obvious failure. Each
   * field falls back on its own, so one bad value does not discard the rest.
   */
  it('keep the good fields and replace the bad ones', () => {
    localStorage.setItem(
      READING_KEY,
      JSON.stringify({ size: 'enormous', leading: 'loose', measure: 42, face: null }),
    );

    expect(getReadingPreferences()).toEqual({
      size: DEFAULT_READING.size,
      leading: 'loose',
      measure: DEFAULT_READING.measure,
      face: DEFAULT_READING.face,
    });
  });

  it('survive a value that is not JSON at all', () => {
    localStorage.setItem(READING_KEY, 'not json {');
    expect(getReadingPreferences()).toEqual(DEFAULT_READING);
  });
});
