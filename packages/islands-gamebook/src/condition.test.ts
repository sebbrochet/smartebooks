import { describe, it, expect } from 'vitest';
import { conditionProse, holds, type Condition } from './condition';
import type { Sheet } from './journey';

const sheet: Sheet = {
  stats: { stamina: 6 },
  items: ['silver key'],
  flags: ['freed the prisoner'],
};

describe('holds', () => {
  it('reads items and flags off the sheet', () => {
    expect(holds(sheet, { kind: 'item', item: 'silver key' })).toBe(true);
    expect(holds(sheet, { kind: 'item', item: 'rope' })).toBe(false);
    expect(holds(sheet, { kind: 'flag', flag: 'freed the prisoner' })).toBe(true);
    expect(holds(sheet, { kind: 'flag', flag: 'paid the ferryman' })).toBe(false);
  });

  // The boundary is the whole question: "STAMINA 6 or more" must include 6.
  it('includes the bound it names', () => {
    const atLeast = (value: number): Condition => ({
      kind: 'stat',
      stat: 'stamina',
      bound: 'atLeast',
      value,
    });
    expect(holds(sheet, atLeast(5))).toBe(true);
    expect(holds(sheet, atLeast(6))).toBe(true);
    expect(holds(sheet, atLeast(7))).toBe(false);

    const atMost = (value: number): Condition => ({
      kind: 'stat',
      stat: 'stamina',
      bound: 'atMost',
      value,
    });
    expect(holds(sheet, atMost(7))).toBe(true);
    expect(holds(sheet, atMost(6))).toBe(true);
    expect(holds(sheet, atMost(5))).toBe(false);
  });

  // Forgiving runtime, strict linter (K4.5): a typo costs a lint error, not a page.
  it('treats a stat the book never declared as zero', () => {
    expect(holds(sheet, { kind: 'stat', stat: 'luck', bound: 'atLeast', value: 1 })).toBe(false);
    expect(holds(sheet, { kind: 'stat', stat: 'luck', bound: 'atMost', value: 1 })).toBe(true);
  });
});

describe('the printed form', () => {
  // QG4's actual claim: every condition this vocabulary can express reads as
  // English, in both polarities. If a shape is ever added that cannot, the
  // fallback is lost and `:::if` stops being a printable directive.
  const everyShape: Condition[] = [
    { kind: 'item', item: 'silver key' },
    { kind: 'flag', flag: 'freed the prisoner' },
    { kind: 'stat', stat: 'stamina', bound: 'atLeast', value: 6 },
    { kind: 'stat', stat: 'stamina', bound: 'atMost', value: 2 },
  ];

  it.each(everyShape)('reads as a sentence: %j', (condition) => {
    for (const negated of [false, true]) {
      const sentence = `If ${conditionProse(condition, negated)}, turn to 45.`;
      expect(sentence).toMatch(/^If you(r)? \S.*, turn to 45\.$/);
    }
  });

  it('prints an item the way a printed gamebook does', () => {
    const key: Condition = { kind: 'item', item: 'silver key' };
    expect(conditionProse(key)).toBe('you have the silver key');
    expect(conditionProse(key, true)).toBe('you do not have the silver key');
  });

  // The flag is authored as a past participle precisely so that negating it
  // needs no verb table — "have not freed" rather than "did not free".
  it('negates a flag without conjugating anything', () => {
    const freed: Condition = { kind: 'flag', flag: 'freed the prisoner' };
    expect(conditionProse(freed)).toBe('you have freed the prisoner');
    expect(conditionProse(freed, true)).toBe('you have not freed the prisoner');
  });

  it('prints a stat in capitals, and both bounds read naturally', () => {
    const atLeast: Condition = { kind: 'stat', stat: 'stamina', bound: 'atLeast', value: 6 };
    const atMost: Condition = { kind: 'stat', stat: 'stamina', bound: 'atMost', value: 2 };

    expect(conditionProse(atLeast)).toBe('your STAMINA is 6 or more');
    expect(conditionProse(atMost)).toBe('your STAMINA is 2 or less');
  });

  // The reason `atMost` exists at all rather than leaning on negation: the
  // prose of a negated bound is clumsier than the bound's own, and the prose is
  // the deliverable here.
  it('negates a bound by flipping it, not by saying "not"', () => {
    const atLeast: Condition = { kind: 'stat', stat: 'stamina', bound: 'atLeast', value: 6 };
    expect(conditionProse(atLeast, true)).toBe('your STAMINA is less than 6');
    expect(conditionProse(atLeast, true)).not.toContain('not');
  });
});
