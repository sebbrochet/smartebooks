import { describe, it, expect } from 'vitest';
import { allowedUnits, railEntries, unitsOf } from './units';
import type { Heading, Unit } from '../markdown/headings';

const markdown = ['# The Caves', '', '## 1', '', 'A door.', '', '## 2', '', 'A grue.'].join('\n');

describe('unitsOf', () => {
  it('has none when the file is the page', () => {
    expect(unitsOf(markdown, undefined)).toEqual([]);
  });

  it('carries every unit the file holds', () => {
    expect(unitsOf(markdown, 2).map((unit) => unit.id)).toEqual(['1', '2']);
  });
});

describe('allowedUnits', () => {
  // Open by default: a book that declares no rule gets everything it wrote.
  it('allows every unit when the book asks nothing', () => {
    expect(allowedUnits(unitsOf(markdown, 2)).map((unit) => unit.id)).toEqual(['1', '2']);
  });

  it('allows only what the book allows', () => {
    const gate = (units: Unit[]) => units.filter((unit) => unit.id === '1');

    expect(allowedUnits(unitsOf(markdown, 2), gate).map((unit) => unit.id)).toEqual(['1']);
  });

  // A gamebook's journey is a history, so its order is the reader's, not the
  // file's — and the same section may legitimately appear twice.
  it('keeps the order the book returns, repeats included', () => {
    const gate = (units: Unit[]) => [units[1], units[0], units[1]];

    expect(allowedUnits(unitsOf(markdown, 2), gate).map((unit) => unit.id)).toEqual(['2', '1', '2']);
  });

  it('can refuse everything without breaking', () => {
    expect(allowedUnits(unitsOf(markdown, 2), () => [])).toEqual([]);
  });

  /**
   * The cost of a gamebook's turn of the page.
   *
   * A gamebook hands the shell a **new gate closure on every choice**, because
   * the gate is built from a journey that has just changed. While the split and
   * the filter were one step, that meant re-parsing the entire book to answer a
   * question about which of its already-parsed sections to show — and a
   * gamebook is the one shape where the whole book sits in a single file.
   *
   * Asserted by **identity, not by timing**: parsing the file again would build
   * new unit objects, so a survivor that is reference-equal to what went in is
   * proof that nothing was re-read. This machine is a loaded VDI where a
   * duration proves nothing, and `toBe` is exact.
   */
  it('filters the units it was handed rather than re-reading the book', () => {
    const carried = unitsOf(markdown, 2);

    for (let choice = 0; choice < 40; choice += 1) {
      const shown = allowedUnits(carried, (units) => units.slice(0, (choice % 2) + 1));
      expect(shown[0]).toBe(carried[0]);
    }
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
    const units = allowedUnits(unitsOf(markdown, 2), (all) => all.slice(0, 1));

    expect(railEntries(units, headings, 2)).toEqual([{ depth: 2, text: '1', id: '1' }]);
  });
});
