import { describe, it, expect } from 'vitest';
import { notesOf, findNote, nameOf, readTune, frequencyOf, noteAt, lengthOf } from './notes';

const scale = 'X:1\nK:C\nCDEF|GABc|';
const midiOf = (abc: string) => notesOf(abc).map((n) => n.midi);

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

  // Case used to mean octave, because matching compared ABC's own token. It no
  // longer does: reaching the upper octave meant writing ABC syntax in a
  // sentence. Both octaves are the same note name, and nth reaches the second.
  it('treats both octaves of a letter as the same name', () => {
    expect(findNote(notes, 'C')).toBe(1);
    expect(findNote(notes, 'c')).toBe(1);
    expect(findNote(notes, 'C', 2)).toBe(8);
  });

  it('falls back to ignoring case when nothing matches exactly', () => {
    expect(findNote(notesOf('X:1\nK:C\nc d e|'), 'C')).toBe(1);
  });

  it('finds a written sharp by the name a book would print', () => {
    const chromatic = notesOf('X:1\nK:C\nC ^C D|');
    expect(findNote(chromatic, 'C#')).toBe(2);
    expect(findNote(chromatic, 'C♯')).toBe(2);
    expect(findNote(chromatic, 'C sharp')).toBe(2);
  });

  it('reads a flat without mistaking it for the letter B', () => {
    const flats = notesOf('X:1\nK:C\nB _B|');
    expect(findNote(flats, 'B')).toBe(1);
    expect(findNote(flats, 'Bb')).toBe(2);
    expect(findNote(flats, 'B♭')).toBe(2);
  });

  // The key signature is not written beside the note, so the token says `F`
  // while the note sounds F sharp. A sentence in G major means that note.
  it('finds a note the key signature altered', () => {
    const inG = notesOf('X:1\nK:G\nF G|');
    expect(findNote(inG, 'F')).toBe(1);
    expect(findNote(inG, 'F#')).toBe(1);
    expect(findNote(inG, 'F♮')).toBeUndefined();
  });

  it('picks between repeats with nth', () => {
    const repeated = notesOf('X:1\nK:C\nC D C|');
    expect(findNote(repeated, 'C', 2)).toBe(3);
  });

  it('resolves to nothing when the label is not in the tune', () => {
    expect(findNote(notes, 'Q')).toBeUndefined();
    expect(findNote(notes, '')).toBeUndefined();
    expect(findNote(notes, 'C', 9)).toBeUndefined();
    expect(findNote(notes, 'C#####')).toBeUndefined();
  });

  // Fixed do: a syllable names a pitch, so Do is C whatever the key.
  it('answers to solfège as readily as to letters', () => {
    expect(findNote(notes, 'Do')).toBe(1);
    expect(findNote(notes, 'Ré')).toBe(2);
    expect(findNote(notes, 'Mi')).toBe(3);
    expect(findNote(notes, 'Fa')).toBe(4);
    expect(findNote(notes, 'Sol')).toBe(5);
    expect(findNote(notes, 'La')).toBe(6);
    expect(findNote(notes, 'Si')).toBe(7);
  });

  it('does not mind the accent or the case', () => {
    expect(findNote(notes, 'Ré')).toBe(2);
    expect(findNote(notes, 're')).toBe(2);
    expect(findNote(notes, 'RE')).toBe(2);
  });

  it('accepts ut, which French still uses for the names of keys', () => {
    expect(findNote(notes, 'Ut')).toBe(1);
  });

  it('reads a French accidental, written long or short', () => {
    const chromatic = notesOf('X:1\nK:C\nC ^C D _D|');
    expect(findNote(chromatic, 'Do dièse')).toBe(2);
    expect(findNote(chromatic, 'Do#')).toBe(2);
    expect(findNote(chromatic, 'Ré bémol')).toBe(4);
    expect(findNote(chromatic, 'Réb')).toBe(4);
  });

  // `sol` must not be read as an `s` followed by nonsense, and `si` + `b` must
  // still come apart into a syllable and a flat.
  it('prefers the longest name, then reads the accidental', () => {
    const tune = notesOf('X:1\nK:C\nG _B|');
    expect(findNote(tune, 'Sol')).toBe(1);
    expect(findNote(tune, 'Sib')).toBe(2);
  });
});

describe('nameOf', () => {
  it('prints a plain note in either vocabulary', () => {
    const [c] = notesOf('X:1\nK:C\nC|');
    expect(nameOf(c)).toBe('C');
    expect(nameOf(c, 'letters')).toBe('C');
    expect(nameOf(c, 'solfege')).toBe('Do');
  });

  it('prints the accidental as a sign, and a natural as nothing', () => {
    const notes = notesOf('X:1\nK:C\n^C _B =C ^^C __B|');
    expect(notes.map((note) => nameOf(note))).toEqual(['C♯', 'B♭', 'C', 'C𝄪', 'B𝄫']);
    expect(notes.map((note) => nameOf(note, 'solfege'))).toEqual([
      'Do♯',
      'Si♭',
      'Do',
      'Do𝄪',
      'Si𝄫',
    ]);
  });

  // The point of showing a name at all: nothing is written beside this note,
  // so a reader cannot see that it sounds a semitone higher than it looks.
  it('prints the accidental the key signature put there', () => {
    const [f] = notesOf('X:1\nK:G\nF|');
    expect(nameOf(f)).toBe('F♯');
    expect(nameOf(f, 'solfege')).toBe('Fa♯');
  });

  it('prints every step', () => {
    expect(notesOf(scale).map((note) => nameOf(note, 'solfege'))).toEqual([
      'Do',
      'Ré',
      'Mi',
      'Fa',
      'Sol',
      'La',
      'Si',
      'Do',
    ]);
  });
});

/**
 * The pitches. None of this is abcjs's: the parser reports the step a note is
 * written on and what accidental was printed beside it, and turning that into a
 * sound is notation's rules, which are the kind of thing that is wrong silently.
 */
describe('what a note sounds', () => {
  it('reads middle C as MIDI 60, and the octave above as 72', () => {
    expect(midiOf('X:1\nK:C\nC c|')).toEqual([60, 72]);
  });

  it('spaces a major scale the way a major scale is spaced', () => {
    // Tones and semitones: the gaps are 2,2,1,2,2,2,1 or it is not a scale.
    expect(midiOf(scale)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('applies the key signature to every octave of the letter', () => {
    // K:G puts a sharp on F. Both Fs must hear it, not just the written one.
    expect(midiOf('X:1\nK:G\nF f|')).toEqual([66, 78]);
  });

  it('lets a written accidental override the key', () => {
    expect(midiOf('X:1\nK:G\n=F|')).toEqual([65]);
  });

  /*
   * The rule that is easiest to miss, and inaudible in a test that only plays
   * the first note of each bar: an accidental holds for the rest of its bar,
   * then stops at the bar line.
   */
  it('carries an accidental to the end of its bar, and no further', () => {
    expect(midiOf('X:1\nK:C\n^F F | F|')).toEqual([66, 66, 65]);
  });

  it('turns a MIDI number into concert pitch', () => {
    expect(frequencyOf(69)).toBeCloseTo(440);
    expect(frequencyOf(60)).toBeCloseTo(261.63, 1);
  });
});

/** The clock. A cursor that follows the sound needs both to agree. */
describe('when a note sounds', () => {
  it('reads the tune’s own tempo', () => {
    const tune = readTune('X:1\nQ:1/4=90\nK:C\nC|');
    expect(tune.bpm).toBe(90);
    expect(tune.beat).toBe(0.25);
  });

  it('falls back to a sensible tempo when the tune names none', () => {
    expect(readTune(scale).bpm).toBe(120);
  });

  it('places each note after the one before it', () => {
    // `L:1/4` is stated rather than assumed: ABC's default note length is an
    // eighth, which is exactly the sort of thing a test should not leave implied.
    const notes = notesOf('X:1\nL:1/4\nQ:1/4=120\nK:C\nC D E|');
    expect(notes.map((n) => n.start)).toEqual([0, 0.5, 1]);
    expect(notes.map((n) => n.seconds)).toEqual([0.5, 0.5, 0.5]);
  });

  it('gives a longer note more time', () => {
    const notes = notesOf('X:1\nL:1/4\nQ:1/4=120\nK:C\nC2 D|');
    expect(notes[0].seconds).toBe(1);
    expect(notes[1].start).toBe(1);
  });

  // A rest makes no sound and is not a note, but it does take time — and a
  // player that ignored it would run ahead of the page.
  it('leaves a gap where a rest is', () => {
    const notes = notesOf('X:1\nL:1/4\nQ:1/4=120\nK:C\nC z D|');
    expect(notes.map((n) => n.start)).toEqual([0, 1]);
  });
});

/**
 * SPEC017 QN9. The cursor does not count notes; it asks the audio clock what
 * time it is and looks the answer up here. Everything about that is in this
 * one pure function, which is the point of writing it this way.
 */
describe('noteAt', () => {
  const notes = notesOf('X:1\nL:1/4\nQ:1/4=120\nK:C\nC z D|');

  it('finds the note sounding at a moment', () => {
    expect(noteAt(notes, 0)).toBe(1);
    expect(noteAt(notes, 0.4)).toBe(1);
    expect(noteAt(notes, 1.2)).toBe(2);
  });

  it('says nothing is sounding during a rest', () => {
    expect(noteAt(notes, 0.7)).toBeUndefined();
  });

  it('says nothing before the start or after the end', () => {
    expect(noteAt(notes, -1)).toBeUndefined();
    expect(noteAt(notes, 99)).toBeUndefined();
  });

  // The boundary: a note ends exactly where the next begins, and a cursor that
  // rounded the wrong way would flicker on every change.
  it('hands over cleanly at the join', () => {
    const run = notesOf('X:1\nL:1/4\nQ:1/4=120\nK:C\nC D|');
    expect(noteAt(run, 0.5)).toBe(2);
    expect(noteAt(run, 0.499)).toBe(1);
  });

  it('measures how long the tune lasts', () => {
    expect(lengthOf(notes)).toBe(1.5);
    expect(lengthOf([])).toBe(0);
  });
});
