import { describe, it, expect } from 'vitest';
import { attrFlag, attrNumber, attrText, resolveAttributes } from './attributes';
import type { AttributeSpec } from './attributes';

const specs: Record<string, AttributeSpec> = {
  title: { type: 'string', default: 'Untitled' },
  src: { type: 'string', required: true },
  theme: { type: 'enum', values: ['brown', 'blue'], default: 'brown' },
  analysis: { type: 'boolean', default: false },
  depth: { type: 'number', default: 12, min: 1, max: 30 },
};

const resolve = (raw: Record<string, string>) => resolveAttributes(specs, raw);

describe('resolveAttributes', () => {
  it('passes everything through untouched when no schema is declared', () => {
    const { values, problems } = resolveAttributes(undefined, { a: '1', b: 'x' });
    expect(values).toEqual({ a: '1', b: 'x' });
    expect(problems).toEqual([]);
  });

  it('applies defaults for attributes the author omitted', () => {
    const { values } = resolve({ src: 'a.mp4' });
    expect(values.title).toBe('Untitled');
    expect(values.theme).toBe('brown');
    expect(values.analysis).toBe(false);
    expect(values.depth).toBe(12);
  });

  it('coerces numbers and booleans out of strings', () => {
    const { values } = resolve({ src: 'a.mp4', depth: '20', analysis: 'true' });
    expect(values.depth).toBe(20);
    expect(values.analysis).toBe(true);
  });

  // `:::chess-board{analysis}` is the natural way to write a flag.
  it('treats a bare flag as true', () => {
    expect(resolve({ src: 'a.mp4', analysis: '' }).values.analysis).toBe(true);
  });

  it('accepts the spellings authors actually use for booleans', () => {
    for (const yes of ['on', 'yes', '1', 'TRUE']) {
      expect(resolve({ src: 'a.mp4', analysis: yes }).values.analysis).toBe(true);
    }
    for (const no of ['off', 'no', '0', 'False']) {
      expect(resolve({ src: 'a.mp4', analysis: no }).values.analysis).toBe(false);
    }
  });

  it('keeps attributes the schema does not mention', () => {
    expect(resolve({ src: 'a.mp4', 'data-extra': 'kept' }).values['data-extra']).toBe('kept');
  });

  it('reports a missing required attribute', () => {
    const { problems } = resolve({});
    expect(problems.map((p) => p.rule)).toContain('attribute-required');
    expect(problems.find((p) => p.attribute === 'src')?.message).toMatch(/required/);
  });

  // Imported books are untrusted: an unknown enum value must never reach a
  // className, so it falls back rather than passing through.
  it('falls back to the default for a value outside the allow-list', () => {
    const { values, problems } = resolve({ src: 'a.mp4', theme: 'hot-pink' });
    expect(values.theme).toBe('brown');
    expect(problems.map((p) => p.rule)).toEqual(['attribute-invalid']);
  });

  it('falls back rather than throwing on a non-numeric number', () => {
    const { values, problems } = resolve({ src: 'a.mp4', depth: 'deep' });
    expect(values.depth).toBe(12);
    expect(problems).toHaveLength(1);
  });

  it('clamps to the declared range and says so', () => {
    expect(resolve({ src: 'a.mp4', depth: '99' }).values.depth).toBe(12);
    expect(resolve({ src: 'a.mp4', depth: '0' }).problems).toHaveLength(1);
  });

  it('rejects a boolean it cannot read, keeping the default', () => {
    const { values, problems } = resolve({ src: 'a.mp4', analysis: 'maybe' });
    expect(values.analysis).toBe(false);
    expect(problems).toHaveLength(1);
  });
});

describe('attribute readers', () => {
  it('narrow a value to the declared type', () => {
    expect(attrText('hello')).toBe('hello');
    expect(attrFlag(true)).toBe(true);
    expect(attrNumber(7)).toBe(7);
  });

  it('fall back when the value is the wrong type or absent', () => {
    expect(attrText(undefined, 'Video')).toBe('Video');
    expect(attrText(42, 'Video')).toBe('Video');
    expect(attrFlag('true', false)).toBe(false);
    expect(attrNumber('7', 1)).toBe(1);
  });
});
