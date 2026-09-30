import { describe, it, expect } from 'vitest';
import { extractAnnotations, parseShapes } from './shapes';

describe('parseShapes', () => {
  it('reads an arrow as origin, destination and brush', () => {
    expect(parseShapes('Gd1h5')).toEqual([{ orig: 'd1', dest: 'h5', brush: 'green' }]);
  });

  it('reads a two-square token as a square highlight, with no destination', () => {
    expect(parseShapes('Rf7')).toEqual([{ orig: 'f7', brush: 'red' }]);
  });

  it('accepts commas or spaces between tokens', () => {
    expect(parseShapes('Gd1h5,Rf7')).toEqual(parseShapes('Gd1h5 Rf7'));
    expect(parseShapes('Gd1h5, Rf7')).toHaveLength(2);
  });

  it('knows the four colours the tag syntax defines', () => {
    expect(parseShapes('Ge4 Re4 Ye4 Be4').map((shape) => shape.brush)).toEqual([
      'green',
      'red',
      'yellow',
      'blue',
    ]);
  });

  // Content may be untrusted and a brush name reaches a CSS class, so anything
  // unrecognised is dropped rather than passed through.
  it('drops tokens it does not understand instead of passing them on', () => {
    expect(parseShapes('Xd1h5')).toEqual([]); // unknown colour
    expect(parseShapes('Gz9')).toEqual([]); // not a square
    expect(parseShapes('Gd1h5h5')).toEqual([]); // wrong length
    expect(parseShapes('G')).toEqual([]);
    expect(parseShapes('')).toEqual([]);
    expect(parseShapes(undefined)).toEqual([]);
  });

  it('keeps the good tokens when one in the list is bad', () => {
    expect(parseShapes('Gd1h5 nonsense Rf7')).toHaveLength(2);
  });
});

describe('extractAnnotations', () => {
  it('pulls arrows out of a %cal tag', () => {
    const { shapes } = extractAnnotations('Threatening mate. [%cal Gd1h5,Gc4f7]');
    expect(shapes).toEqual([
      { orig: 'd1', dest: 'h5', brush: 'green' },
      { orig: 'c4', dest: 'f7', brush: 'green' },
    ]);
  });

  it('pulls square highlights out of a %csl tag', () => {
    expect(extractAnnotations('[%csl Rf7]').shapes).toEqual([{ orig: 'f7', brush: 'red' }]);
  });

  it('reads both tags in one comment', () => {
    expect(extractAnnotations('[%csl Rf7] [%cal Gd1h5]').shapes).toHaveLength(2);
  });

  // The whole point of extracting rather than just parsing: a reader must never
  // be shown "[%cal Gd1h5]" in the middle of a sentence.
  it('removes the tags from the prose', () => {
    expect(extractAnnotations('White eyes f7. [%cal Gc4f7] It is weak.').text).toBe(
      'White eyes f7. It is weak.',
    );
  });

  it('leaves a comment without tags exactly as written', () => {
    expect(extractAnnotations('A quiet move.').text).toBe('A quiet move.');
  });

  it('reports empty text for a comment that is only a tag', () => {
    expect(extractAnnotations('[%cal Gd1h5]').text).toBe('');
  });
});

/**
 * Shapes taken from real annotated games rather than invented, because every
 * one of these occurs in exported PGN and the previous pattern met none of them.
 */
describe('stored evaluations', () => {
  it('reads a %eval tag', () => {
    expect(extractAnnotations('[%eval 0.54]').evaluation).toBe('0.54');
  });

  it('keeps the sign of an evaluation favouring Black', () => {
    expect(extractAnnotations('[%eval -1.3]').evaluation).toBe('-1.3');
  });

  it('reads a forced mate for either side', () => {
    expect(extractAnnotations('[%eval #5]').evaluation).toBe('#5');
    expect(extractAnnotations('[%eval #-3]').evaluation).toBe('#-3');
  });

  // Lichess writes no leading "+"; some tools do. One stored form, so nothing
  // downstream has to know both.
  it('normalises a leading plus away', () => {
    expect(extractAnnotations('[%eval +0.54]').evaluation).toBe('0.54');
  });

  it('removes the evaluation from the prose', () => {
    expect(extractAnnotations('Inaccuracy. [%eval 0.54] d5 was best.').text).toBe(
      'Inaccuracy. d5 was best.',
    );
  });

  it('reports no evaluation when the comment carries none', () => {
    expect(extractAnnotations('A quiet move.').evaluation).toBeUndefined();
  });

  // Forgiving runtime: an unreadable value is dropped, exactly as an unknown
  // brush is. The linter is where the author gets told.
  it('drops a value that is not an evaluation', () => {
    expect(extractAnnotations('[%eval winning]').evaluation).toBeUndefined();
    expect(extractAnnotations('[%eval winning]').text).toBe('');
  });

  it('is padded with spaces inside the braces, as Lichess writes it', () => {
    expect(extractAnnotations(' [%eval 0.15] ').evaluation).toBe('0.15');
  });

  it('sits beside other tags with no separator between them', () => {
    const { evaluation, shapes, text } = extractAnnotations('[%eval 0.56][%csl Gd6][%cal Gd7d6]');
    expect(evaluation).toBe('0.56');
    expect(shapes).toHaveLength(2);
    expect(text).toBe('');
  });

  it('takes the first evaluation when a comment carries two', () => {
    expect(extractAnnotations('[%eval 0.1] [%eval 0.9]').evaluation).toBe('0.1');
  });
});

/**
 * Until 2026-09-30 the pattern named `cal` and `csl`, so every other tag family
 * reached the reader as prose. These are the ones real exports actually carry.
 */
describe('tags we do not understand', () => {
  it('removes a clock tag', () => {
    expect(extractAnnotations('[%clk 0:03:00]').text).toBe('');
  });

  it('removes a timestamp written beside an evaluation', () => {
    const { text, evaluation } = extractAnnotations('[%ts 0:22] [%eval 0.30]');
    expect(text).toBe('');
    expect(evaluation).toBe('0.30');
  });

  it('removes a tag that carries no value at all', () => {
    expect(extractAnnotations('Sharp. [%novalue] Very sharp.').text).toBe('Sharp. Very sharp.');
  });

  it('leaves prose containing brackets alone', () => {
    const text = 'See the note [1] and https://example.com/a,b for more.';
    expect(extractAnnotations(text).text).toBe(text);
  });
});
