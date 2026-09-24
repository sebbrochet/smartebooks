import abcjs from 'abcjs';

export interface MusicNote {
  /** 1-based place in the piece. This is the sequence position, as a number. */
  index: number;
  /** The pitch as ABC spells it: `C` and `c` are an octave apart. */
  name: string;
}

interface ParsedElement {
  el_type?: string;
  rest?: unknown;
  pitches?: Array<{ name?: string }>;
}

/**
 * The notes of a tune, in playing order.
 *
 * Pure and DOM-free on purpose: `parseOnly` is abcjs's parser without its
 * engraver, so this is unit-testable and the drawing stays in the component.
 * Rests are not notes — they have no pitch to name and nothing to point at.
 */
export function notesOf(abc: string): MusicNote[] {
  const source = abc.trim();
  if (!source) return [];

  let tune;
  try {
    tune = abcjs.parseOnly(source)[0];
  } catch {
    return [];
  }
  if (!tune) return [];

  const notes: MusicNote[] = [];
  for (const line of tune.lines ?? []) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices ?? []) {
        for (const element of voice as ParsedElement[]) {
          if (element.el_type !== 'note' || element.rest) continue;
          const name = (element.pitches ?? [])
            .map((pitch) => pitch.name ?? '')
            .filter(Boolean)
            .join('');
          if (!name) continue;
          notes.push({ index: notes.length + 1, name });
        }
      }
    }
  }
  return notes;
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
