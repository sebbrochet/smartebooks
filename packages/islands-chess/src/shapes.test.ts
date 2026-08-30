import { describe, it, expect } from 'vitest';
import { extractShapes, parseShapes } from './shapes';

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

describe('extractShapes', () => {
  it('pulls arrows out of a %cal tag', () => {
    const { shapes } = extractShapes('Threatening mate. [%cal Gd1h5,Gc4f7]');
    expect(shapes).toEqual([
      { orig: 'd1', dest: 'h5', brush: 'green' },
      { orig: 'c4', dest: 'f7', brush: 'green' },
    ]);
  });

  it('pulls square highlights out of a %csl tag', () => {
    expect(extractShapes('[%csl Rf7]').shapes).toEqual([{ orig: 'f7', brush: 'red' }]);
  });

  it('reads both tags in one comment', () => {
    expect(extractShapes('[%csl Rf7] [%cal Gd1h5]').shapes).toHaveLength(2);
  });

  // The whole point of extracting rather than just parsing: a reader must never
  // be shown "[%cal Gd1h5]" in the middle of a sentence.
  it('removes the tags from the prose', () => {
    expect(extractShapes('White eyes f7. [%cal Gc4f7] It is weak.').text).toBe(
      'White eyes f7. It is weak.',
    );
  });

  it('leaves a comment without tags exactly as written', () => {
    expect(extractShapes('A quiet move.').text).toBe('A quiet move.');
  });

  it('reports empty text for a comment that is only a tag', () => {
    expect(extractShapes('[%cal Gd1h5]').text).toBe('');
  });
});
