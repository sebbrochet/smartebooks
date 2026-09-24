import { describe, it, expect } from 'vitest';
import { notesOf, findNote } from './notes';

const scale = 'X:1\nK:C\nCDEF|GABc|';

describe('notesOf', () => {
  it('reads the notes of a tune in playing order', () => {
    expect(notesOf(scale).map((n) => n.name)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'c']);
  });

  it('numbers them from one, so a position is countable by a human', () => {
    expect(notesOf(scale).map((n) => n.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  // A rest has no pitch to name and nothing to point at, so it is not a note
  // the prose can refer to — but it must not shift the numbering of the ones
  // after it either, which is why this checks the names and not just the count.
  it('skips rests', () => {
    expect(notesOf('X:1\nK:C\nC z D|').map((n) => n.name)).toEqual(['C', 'D']);
  });

  it('has nothing to say about an empty or unparseable tune', () => {
    expect(notesOf('')).toEqual([]);
    expect(notesOf('   ')).toEqual([]);
  });
});

describe('findNote', () => {
  const notes = notesOf(scale);

  it('finds a note by the pitch the author wrote', () => {
    expect(findNote(notes, 'E')).toBe(3);
  });

  // ABC spells octaves with case: `c` is an octave above `C`. An author who
  // knows that gets precision.
  it('tells the octaves apart when the author spelled them', () => {
    expect(findNote(notes, 'C')).toBe(1);
    expect(findNote(notes, 'c')).toBe(8);
  });

  // …and one writing prose still lands somewhere sensible.
  it('falls back to ignoring case when nothing matches exactly', () => {
    expect(findNote(notesOf('X:1\nK:C\nc d e|'), 'C')).toBe(1);
  });

  it('picks between repeats with nth', () => {
    const repeated = notesOf('X:1\nK:C\nC D C|');
    expect(findNote(repeated, 'C', 2)).toBe(3);
  });

  it('resolves to nothing when the label is not in the tune', () => {
    expect(findNote(notes, 'Q')).toBeUndefined();
    expect(findNote(notes, '')).toBeUndefined();
    expect(findNote(notes, 'C', 9)).toBeUndefined();
  });
});
