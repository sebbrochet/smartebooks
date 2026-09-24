import { frequencyOf, lengthOf, noteAt, type MusicNote } from './notes';

/**
 * The oscillator (SPEC017 §4.1.1).
 *
 * No samples, no soundfont, no network: for a book about theory the point is
 * hearing an interval, not enjoying a performance, and timbre is not the
 * content. Everything that makes a noise is in this file, so the day a book
 * needs a real instrument, this is the only file that changes.
 */

/** A shaped note, so the ear hears a note rather than a click. */
const ATTACK = 0.01;
const RELEASE = 0.06;
/** Well below full scale: several notes may overlap, and none of this is loud. */
const LEVEL = 0.18;
/** A moment's head start, so the first note is scheduled rather than chased. */
const LEAD_IN = 0.06;

let shared: AudioContext | undefined;

/**
 * One context for the page, made on demand.
 *
 * Browsers refuse to start audio before the reader has asked for it and limit
 * how many contexts a page may have — a chapter with fifty figures must not
 * open fifty. The chess pack holds its engine the same way, for the same
 * reason.
 */
function audio(): AudioContext | undefined {
  if (shared) return shared;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  shared = new Ctor();
  return shared;
}

/** True when this browser can make a sound at all. */
export function canPlay(): boolean {
  return Boolean(
    window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext,
  );
}

export interface Playing {
  stop(): void;
}

/**
 * Play a tune, and tell the caller which note is sounding as it goes.
 *
 * **Two clocks, and only one of them is in charge.** The notes are scheduled
 * ahead against the audio clock, which is the only one accurate enough to hold
 * a rhythm; the cursor is then driven by *asking that clock the time* on every
 * animation frame and looking up the answer. Counting notes on a timer would
 * drift, and driving audio from React would stutter.
 */
export function playNotes(
  notes: readonly MusicNote[],
  onNote: (index: number | undefined) => void,
  onEnd: () => void,
): Playing {
  const context = audio();
  if (!context || notes.length === 0) {
    onEnd();
    return { stop: () => {} };
  }

  // A context made before the reader's first gesture starts suspended, and a
  // suspended context's clock does not advance — so the cursor would sit still
  // while nothing played.
  void context.resume();

  const started = context.currentTime + LEAD_IN;
  const ending = started + lengthOf(notes);
  const voices: OscillatorNode[] = [];

  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = started + note.start;
    const until = at + note.seconds;

    oscillator.type = 'triangle';
    oscillator.frequency.value = frequencyOf(note.midi);

    // Ramps rather than steps: an oscillator switched on at full gain starts
    // mid-waveform and the discontinuity is audible as a tick on every note.
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(LEVEL, at + ATTACK);
    gain.gain.setValueAtTime(LEVEL, Math.max(at + ATTACK, until - RELEASE));
    gain.gain.linearRampToValueAtTime(0, until);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(until);
    voices.push(oscillator);
  }

  let frame = 0;
  let live = true;

  const follow = () => {
    if (!live) return;
    if (context.currentTime >= ending) {
      stop();
      return;
    }
    onNote(noteAt(notes, context.currentTime - started));
    frame = requestAnimationFrame(follow);
  };
  frame = requestAnimationFrame(follow);

  function stop() {
    if (!live) return;
    live = false;
    cancelAnimationFrame(frame);
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {
        // Already finished: stopping a stopped oscillator is not an error worth
        // reporting to a reader.
      }
    }
    onNote(undefined);
    onEnd();
  }

  return { stop };
}
