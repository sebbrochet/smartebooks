import abcjs from 'abcjs';

export interface MusicNote {
  /** 1-based place in the piece. This is the sequence position, as a number. */
  index: number;
  /** The pitch as ABC spells it: `C` and `c` are an octave apart. */
  name: string;
  /** MIDI number, 60 being middle C. */
  midi: number;
  /** Seconds from the start of the piece, at the tune's own tempo. */
  start: number;
  /** Seconds. */
  seconds: number;
}

export interface Tune {
  notes: MusicNote[];
  /** Beats per minute, and the note length that counts as the beat. */
  bpm: number;
  beat: number;
}

/** Semitones above the tonic for each step of a major scale. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** What a written accidental does to a pitch, in semitones. */
const ACCIDENTAL: Record<string, number> = {
  sharp: 1,
  flat: -1,
  dblsharp: 2,
  dblflat: -2,
  natural: 0,
};

/** A tune with no `Q:` field is read at the usual default of 120 quarter notes. */
const DEFAULT_BPM = 120;
const DEFAULT_BEAT = 0.25;

interface ParsedPitch {
  name?: string;
  pitch?: number;
  accidental?: string;
}

interface ParsedElement {
  el_type?: string;
  rest?: unknown;
  duration?: number;
  pitches?: ParsedPitch[];
}

/**
 * Everything the pack needs from a tune: the notes, their pitches, and when
 * each one sounds.
 *
 * Pure and DOM-free on purpose — `parseOnly` is abcjs's parser without its
 * engraver — so the music theory below is unit-testable, and neither the
 * drawing nor the sound is anywhere near it.
 *
 * **One traversal, deliberately.** The index a mark in the prose points at and
 * the moment that note is heard have to agree; counting them in the same place
 * is the only way to be sure they cannot drift apart.
 */
export function readTune(abc: string): Tune {
  const source = abc.trim();
  const silence: Tune = { notes: [], bpm: DEFAULT_BPM, beat: DEFAULT_BEAT };
  if (!source) return silence;

  let tune;
  try {
    tune = abcjs.parseOnly(source)[0];
  } catch {
    return silence;
  }
  if (!tune) return silence;

  const tempo = tune.metaText?.tempo as { bpm?: number; duration?: number[] } | undefined;
  const bpm = tempo?.bpm && tempo.bpm > 0 ? tempo.bpm : DEFAULT_BPM;
  const beat = tempo?.duration?.[0] && tempo.duration[0] > 0 ? tempo.duration[0] : DEFAULT_BEAT;
  const secondsPerWhole = (60 / bpm) * (1 / beat);

  const notes: MusicNote[] = [];
  let elapsed = 0;
  let keySignature: Record<string, number> = {};
  // An accidental written in a bar holds until the bar line. That is notation's
  // rule rather than abcjs's: the parser reports what is written, so carrying
  // it is ours to do, and forgetting would play a natural where the page says
  // sharp.
  let barAccidentals: Record<string, number> = {};

  for (const line of tune.lines ?? []) {
    for (const staff of line.staff ?? []) {
      const written = (staff.key as { accidentals?: Array<{ acc?: string; note?: string }> })
        ?.accidentals;
      if (written) {
        keySignature = {};
        for (const accidental of written) {
          const letter = (accidental.note ?? '').toLowerCase();
          if (letter) keySignature[letter] = ACCIDENTAL[accidental.acc ?? ''] ?? 0;
        }
      }

      for (const voice of staff.voices ?? []) {
        for (const element of voice as ParsedElement[]) {
          if (element.el_type === 'bar') {
            barAccidentals = {};
            continue;
          }
          if (element.el_type !== 'note') continue;

          const seconds = (element.duration ?? 0) * secondsPerWhole;

          if (element.rest || !element.pitches?.length) {
            elapsed += seconds;
            continue;
          }

          // A chord sounds as one event and is named by its lowest pitch, which
          // is enough for a book that points at notes rather than at voices.
          const pitch = element.pitches[0];
          const step = pitch.pitch ?? 0;
          const letter = letterOf(step);
          const accidental = pitch.accidental ? ACCIDENTAL[pitch.accidental] : undefined;

          if (accidental !== undefined) barAccidentals[letter] = accidental;
          const offset = barAccidentals[letter] ?? keySignature[letter] ?? 0;

          notes.push({
            index: notes.length + 1,
            name: element.pitches
              .map((each) => each.name ?? '')
              .filter(Boolean)
              .join(''),
            midi: 60 + semitonesOf(step) + offset,
            start: elapsed,
            seconds,
          });
          elapsed += seconds;
        }
      }
    }
  }

  return { notes, bpm, beat };
}

/** The notes of a tune, in playing order. Rests are not notes. */
export function notesOf(abc: string): MusicNote[] {
  return readTune(abc).notes;
}

/** Semitones above middle C for a diatonic step, where 0 is middle C. */
function semitonesOf(step: number): number {
  const octave = Math.floor(step / 7);
  return MAJOR[((step % 7) + 7) % 7] + octave * 12;
}

/** The letter a step is written with, which is what a key signature names. */
function letterOf(step: number): string {
  return 'cdefgab'[((step % 7) + 7) % 7];
}

/** Concert pitch, A4 = 440Hz. */
export function frequencyOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * The note sounding at a moment, or `undefined` before the first and after the
 * last.
 *
 * This is where the cursor and the sound meet (SPEC017 QN9). It is a lookup
 * rather than a counter on purpose: the audio clock is the only thing that
 * knows where playback really is, so the page asks it *what time is it* and
 * answers *which note is that* here, instead of both sides counting and
 * drifting apart.
 *
 * A rest is a gap: between two notes there is a moment that is no note at all,
 * and saying so is more honest than holding the previous one lit.
 */
export function noteAt(notes: readonly MusicNote[], seconds: number): number | undefined {
  for (const note of notes) {
    if (seconds < note.start) return undefined;
    if (seconds < note.start + note.seconds) return note.index;
  }
  return undefined;
}

/** How long the tune lasts, in seconds. */
export function lengthOf(notes: readonly MusicNote[]): number {
  const last = notes[notes.length - 1];
  return last ? last.start + last.seconds : 0;
}

/**
 * The note a label in the prose refers to, or `undefined`.
 *
 * The label is the pitch the author wrote — `:note[G]` — because the chess pack
 * settled the general question already: a path like `at="0.0.1"` is not
 * something anyone should have to write (SPEC008 G4.1).
 *
 * Matching is exact first and case-insensitive second, which is the repo's
 * usual split: ABC spells octaves with case, so `c` really is a different note
 * from `C` and an author who knows that gets precision — while one who wrote
 * "the C at the end" in a sentence still lands somewhere sensible. `nth` picks
 * between repeats, counting from one.
 */
export function findNote(notes: readonly MusicNote[], label: string, nth = 1): number | undefined {
  const wanted = label.trim();
  if (!wanted || nth < 1) return undefined;

  const exact = notes.filter((note) => note.name === wanted);
  const matches =
    exact.length > 0
      ? exact
      : notes.filter((note) => note.name.toLowerCase() === wanted.toLowerCase());

  return matches[nth - 1]?.index;
}
