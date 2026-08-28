import { describe, it, expect } from 'vitest';
import { mermaidIslands, resolveTheme, MERMAID_THEMES, DEFAULT_THEME } from './index';

describe('mermaidIslands', () => {
  it('provides a single island named after the notation', () => {
    expect(mermaidIslands().map((i) => i.name)).toEqual(['mermaid']);
  });

  it('extracts the diagram from a fenced body', () => {
    const [island] = mermaidIslands();
    const node = {
      children: [{ type: 'code', lang: 'mermaid', value: 'flowchart TD\n  A --> B' }],
    };
    expect(island.extract?.(node as never)).toEqual({ code: 'flowchart TD\n  A --> B' });
  });

  // Without JavaScript a diagram cannot be drawn, so an export should still
  // carry the source rather than a blank space (SPEC001 P1.1).
  it('falls back to the diagram source', () => {
    const [island] = mermaidIslands();
    const fallback = island.fallback?.({} as never, { code: 'flowchart TD' }, {
      attributes: {},
    } as never);
    expect(fallback).toEqual([{ type: 'code', lang: 'mermaid', value: 'flowchart TD' }]);
  });

  it('has no fallback for an empty diagram', () => {
    const [island] = mermaidIslands();
    expect(island.fallback?.({} as never, { code: '   ' }, { attributes: {} } as never)).toBe(
      undefined,
    );
  });

  it("uses the book's theme as the attribute default", () => {
    const [island] = mermaidIslands({ theme: 'forest' });
    expect(island.attributes?.theme).toMatchObject({ type: 'enum', default: 'forest' });
  });
});

/**
 * A book's pack options come from a descriptor inside an untrusted zip, and the
 * theme is interpolated into Mermaid's `init` directive — so an unrecognised
 * value must never survive.
 */
describe('resolveTheme', () => {
  it('accepts every theme it advertises', () => {
    for (const theme of MERMAID_THEMES) expect(resolveTheme(theme)).toBe(theme);
  });

  it.each([
    'evil',
    '"} , "securityLevel": "loose", "x": "',
    '<script>alert(1)</script>',
    42,
    null,
    undefined,
    {},
    [],
  ])('falls back for %j', (value) => {
    expect(MERMAID_THEMES).toContain(resolveTheme(value));
  });

  it('falls back to the default rather than throwing', () => {
    expect(resolveTheme('nope')).toBe(DEFAULT_THEME);
  });

  it('defaults to following the reader', () => {
    expect(DEFAULT_THEME).toBe('auto');
  });

  it('survives hostile book options without throwing', () => {
    for (const options of [null, 'x', 42, [], { theme: { evil: true } }]) {
      expect(() => mermaidIslands(options as never)).not.toThrow();
    }
  });
});
