import { describe, it, expect } from 'vitest';
import { allowedUnits, railEntries } from './units';
import type { Heading, Unit } from '../markdown/headings';

const markdown = ['# The Caves', '', '## 1', '', 'A door.', '', '## 2', '', 'A grue.'].join('\n');

describe('allowedUnits', () => {
  it('has none when the file is the page', () => {
    expect(allowedUnits(markdown, undefined)).toEqual([]);
  });

  // Open by default: a book that declares no rule gets everything it wrote.
  it('allows every unit when the book asks nothing', () => {
    expect(allowedUnits(markdown, 2).map((unit) => unit.id)).toEqual(['1', '2']);
  });

  it('allows only what the book allows', () => {
    const gate = (units: Unit[]) => units.filter((unit) => unit.id === '1');

    expect(allowedUnits(markdown, 2, gate).map((unit) => unit.id)).toEqual(['1']);
  });

  // A gamebook's journey is a history, so its order is the reader's, not the
  // file's — and the same section may legitimately appear twice.
  it('keeps the order the book returns, repeats included', () => {
    const gate = (units: Unit[]) => [units[1], units[0], units[1]];

    expect(allowedUnits(markdown, 2, gate).map((unit) => unit.id)).toEqual(['2', '1', '2']);
  });

  it('can refuse everything without breaking', () => {
    expect(allowedUnits(markdown, 2, () => [])).toEqual([]);
  });
});

describe('railEntries', () => {
  const headings: Heading[] = [{ depth: 2, text: 'Why islands', id: 'why-islands' }];

  it('lists the page headings when the book has no units', () => {
    expect(railEntries([], headings, 2)).toBe(headings);
  });

  /**
   * The rail is the other half of the gate. Listing the file's headings in a
   * units book would name every section it contains — the ending included —
   * which is SPEC011 B2 one level up from the page.
   */
  it('lists the allowed units, and nothing the book withheld', () => {
    const units = allowedUnits(markdown, 2, (all) => all.slice(0, 1));

    expect(railEntries(units, headings, 2)).toEqual([{ depth: 2, text: '1', id: '1' }]);
  });
});
