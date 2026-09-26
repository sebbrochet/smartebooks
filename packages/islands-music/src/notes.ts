import abcjs from 'abcjs';

export interface MusicNote {
  /** 1-based place in the piece. This is the sequence position, as a number. */
  index: number;
  /** The pitch as ABC spells it: `C` and `c` are an octave apart. */
  name: string;
  /** 0–6, C to B: the letter alone, with no accidental and no octave. */
  step: number;
  /**
   * The accidental **in force**, in semitones, −2 to 2.
   *
   * Written, else the bar's, else the key signature's — so in G major an `F`
   * has `alter: 1` even though nothing is written beside it. `name` cannot say
   * this: it is the token on the page, and the key signature is somewhere else.
   */
  alter: number;
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
  startTie?: unknown;
  endTie?: unknown;
}

interface ParsedElement {
  el_type?: string;
  rest?: unknown;
  duration?: number;
  pitches?: ParsedPitch[];
  startTriplet?: unknown;
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
            step: ((step % 7) + 7) % 7,
            alter: offset,
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

/**
 * What this tune contains that {@link readTune} cannot represent.
 *
 * The model is one note at a time, each sounding once for its written length.
 * Four things in ABC break that, and all four are **silent** at read time: the
 * score draws correctly, because engraving is abcjs's job, and only the sound
 * and the `:note[…]` marks are wrong. A linter uses this to refuse them rather
 * than let a book ship music that plays wrongly.
 *
 * Shares the parser with `readTune` on purpose — a regex over ABC source would
 * be a second implementation of "what is in this tune", and would drift.
 */
export function unplayableIn(abc: string): string[] {
  const source = abc.trim();
  if (!source) return [];

  let tune;
  try {
    tune = abcjs.parseOnly(source)[0];
  } catch {
    return [];
  }
  if (!tune) return [];

  const found = new Set<string>();

  for (const line of tune.lines ?? []) {
    // Two `V:` voices come back as two *staves within one line*, not as two
    // voices on one staff. Counting staves across the whole tune instead would
    // call every melody written over several systems polyphonic.
    if ((line.staff ?? []).length > 1) found.add('voices');

    for (const staff of line.staff ?? []) {
      if ((staff.voices ?? []).length > 1) found.add('voices');

      for (const voice of staff.voices ?? []) {
        for (const element of voice as ParsedElement[]) {
          if (element.el_type !== 'note' || element.rest) continue;
          if (element.startTriplet !== undefined) found.add('tuplet');
          if ((element.pitches?.length ?? 0) > 1) found.add('chord');
          if (element.pitches?.some((pitch) => pitch.startTie !== undefined)) found.add('tie');
        }
      }
    }
  }

  return [...found];
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
 * **Case no longer means octave.** It used to: matching compared ABC's own
 * token, so `c` was a different note from `C`. That made the upper octave
 * reachable only by writing ABC syntax inside a sentence — the very complaint
 * above — and left a written sharp reachable only as `^C`. `nth` picks between
 * repeats, counting from one, and SPEC018 adds an octave that is written rather
 * than implied by capitalisation.
 */
/**
 * What a book may call each of the seven steps, C first.
 *
 * Both vocabularies are accepted at once and no book has to declare which it
 * uses, because they cannot collide: every letter name is one character and
 * every syllable is two or three. `ut` is the older French name for `do` and
 * survives in the names of keys.
 *
 * A syllable names a **pitch**, not a scale degree — this is fixed do, where
 * `do` is always C. Movable do, where `do` is the tonic, means something else
 * entirely and is deliberately not here (SPEC018 §4.1).
 */
const STEPS: Record<string, number> = {
  c: 0,
  d: 1,
  e: 2,
  f: 3,
  g: 4,
  a: 5,
  b: 6,
  do: 0,
  ut: 0,
  re: 1,
  mi: 2,
  fa: 3,
  sol: 4,
  la: 5,
  si: 6,
};

/**
 * How a book may write an accidental after a note's name.
 *
 * Symbol, ASCII and word, in both vocabularies, because books use all three and
 * an author writing a sentence should not have to reach for a character they
 * cannot type. An empty suffix is *not* in here: it means "any", which is a
 * different thing from natural and is handled by the parser.
 */
const ALTERATIONS: Record<string, number> = {
  '\u266f': 1,
  '#': 1,
  sharp: 1,
  diese: 1,
  '\u266f\u266f': 2,
  '##': 2,
  x: 2,
  '\u{1D12A}': 2,
  'double sharp': 2,
  'double diese': 2,
  '\u266d': -1,
  b: -1,
  flat: -1,
  bemol: -1,
  '\u266d\u266d': -2,
  bb: -2,
  '\u{1D12B}': -2,
  'double flat': -2,
  'double bemol': -2,
  '\u266e': 0,
  '=': 0,
  natural: 0,
  becarre: 0,
};

/** Lower case and without accents, so *Ré*, *Re* and *RE* are one word. */
function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * A label as a partial spelling: the step, and the accidental if the book said
 * one. `undefined` where it did not, which matches any.
 *
 * The longest name wins, then the rest is the accidental — which is what keeps
 * `Bb` unambiguous (a letter in front, a flat behind) without `sol` being read
 * as an `s`.
 */
function spellingOf(label: string): { step: number; alter?: number } | undefined {
  const wanted = normalise(label);
  if (!wanted) return undefined;

  for (const length of [3, 2, 1]) {
    const step = STEPS[wanted.slice(0, length)];
    if (step === undefined) continue;

    const rest = wanted.slice(length).trim();
    if (!rest) return { step };

    const alter = ALTERATIONS[rest];
    if (alter !== undefined) return { step, alter };
  }

  return undefined;
}

/**
 * Every note a label names, in playing order.
 *
 * Matching is on the **spelling**, not on ABC's own token, so `:note[C#]` finds
 * a written sharp and `:note[F]` in G major finds the F sharp the key signature
 * put there. An accidental the label leaves out matches any, because a sentence
 * that says "the F" in G major means the one on the page.
 *
 * Exported because a caller that wants to say *how many* there are must not ask
 * the question a second way: `lint-music.mjs` counted near-misses with its own
 * comparison and was already wrong for lowercase ABC names.
 */
export function notesNamed(notes: readonly MusicNote[], label: string): MusicNote[] {
  const wanted = spellingOf(label);
  if (!wanted) return [];

  return notes.filter(
    (note) =>
      note.step === wanted.step && (wanted.alter === undefined || note.alter === wanted.alter),
  );
}

export function findNote(notes: readonly MusicNote[], label: string, nth = 1): number | undefined {
  if (nth < 1) return undefined;
  return notesNamed(notes, label)[nth - 1]?.index;
}
