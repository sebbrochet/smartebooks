import { describe, it, expect } from 'vitest';
import { activeHeading } from './activeHeading';

const THRESHOLD = 96;

describe('activeHeading', () => {
  it('is the last heading to have crossed the line, not the first one visible', () => {
    // "Two" is above the line, "Three" is further down the screen — the reader
    // is reading Two. Picking the first *visible* heading would say Three.
    const offsets = [
      { id: 'one', top: -800 },
      { id: 'two', top: 40 },
      { id: 'three', top: 500 },
    ];
    expect(activeHeading(offsets, THRESHOLD)).toBe('two');
  });

  it('is nothing at all before the first heading', () => {
    // A chapter opens with prose under its title. Marking section one active
    // there makes the rail claim the reader is somewhere they have not reached.
    const offsets = [
      { id: 'one', top: 400 },
      { id: 'two', top: 900 },
    ];
    expect(activeHeading(offsets, THRESHOLD)).toBeUndefined();
  });

  it('is the last heading once the page bottom is reached', () => {
    // The final section is usually shorter than a screen, so its heading can
    // never reach the line however far the reader scrolls. Without this the
    // last entry is permanently unreachable.
    const offsets = [
      { id: 'one', top: -900 },
      { id: 'two', top: -200 },
      { id: 'three', top: 300 },
    ];
    expect(activeHeading(offsets, THRESHOLD)).toBe('two');
    expect(activeHeading(offsets, THRESHOLD, true)).toBe('three');
  });

  it('treats a heading exactly on the line as read', () => {
    expect(activeHeading([{ id: 'one', top: THRESHOLD }], THRESHOLD)).toBe('one');
    expect(activeHeading([{ id: 'one', top: THRESHOLD + 1 }], THRESHOLD)).toBeUndefined();
  });

  it('has no answer for a chapter with no headings, even at the bottom', () => {
    expect(activeHeading([], THRESHOLD)).toBeUndefined();
    expect(activeHeading([], THRESHOLD, true)).toBeUndefined();
  });
});
