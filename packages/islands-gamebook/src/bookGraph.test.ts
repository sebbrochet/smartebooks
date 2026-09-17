import { describe, it, expect } from 'vitest';
import type { Unit } from '@smart-ebooks/engine';
import { graphOf, labelProblems, sectionOf } from './bookGraph';

const unit = (id: string, markdown: string): Unit => ({ id, title: id, markdown });

const rulesOf = (units: Unit[]) => labelProblems(units).map((problem) => problem.rule);

describe('a label that names its own destination', () => {
  /*
   * The shape a whole book can be written in without anyone noticing: every
   * choice reads correctly while it is being offered, and doubles the number
   * the moment the reader has left the section.
   */
  it('is reported', () => {
    const units = [unit('1', '## 1\n\nUne porte. :choice[Rendez-vous au 3]{to="3"}.')];

    expect(rulesOf(units)).toEqual(['choice-label-names-target']);
    expect(labelProblems(units)[0].message).toContain('printed twice');
  });

  it('is a warning, because no reader is blocked by it', () => {
    const units = [unit('1', ':choice[Rendez-vous au 3]{to="3"}.')];

    expect(labelProblems(units)[0].severity).toBe('warning');
  });

  // The form the migration produces: the sentence in the label, the number left
  // to the pack to print in whichever mode the book is being read in.
  it('is not reported once the label carries the sentence instead', () => {
    const units = [unit('1', ':choice[Si vous le laissez partir sans un mot]{to="3"}.')];

    expect(labelProblems(units)).toEqual([]);
  });

  // A choice with no label at all is the bundled demo's own style and the
  // printed gamebook's line. It is only a problem for a reading mode that does
  // not exist yet, so it is deliberately not a rule.
  it('says nothing about a choice written without a label', () => {
    expect(labelProblems([unit('1', 'If you go down at once, :choice{to="2"}.')])).toEqual([]);
  });

  it('matches whole words, so a label may mention a different section', () => {
    expect(labelProblems([unit('1', ':choice[Les 13 gardes]{to="3"}.')])).toEqual([]);
  });

  it('finds it through the awkward spellings too', () => {
    const units = [unit('1', ':choice[Rendez-vous au 3]{to=\'3\'} :choice[Go to 4]{to="4"}')];

    expect(rulesOf(units)).toEqual(['choice-label-names-target', 'choice-label-names-target']);
  });
});

/*
 * Reading the label needed a capturing group where there had been a
 * non-capturing one, which moves the attributes along by one. Everything the
 * graph knows comes out of that same match.
 */
describe('reading the label leaves the graph intact', () => {
  it('still finds where a labelled choice goes', () => {
    expect(sectionOf(unit('1', ':choice[Rendez-vous au 3]{to="3"}')).choices).toEqual(['3']);
  });

  it('still finds where a death respawns', () => {
    expect(sectionOf(unit('6', ':death[*Your story ends here.*]{to="4"}'))).toEqual({
      id: '6',
      choices: [],
      kind: 'death',
      respawn: '4',
    });
  });

  it('still reads a whole book', () => {
    const book = graphOf([unit('1', 'A door. :choice{to="2"}.'), unit('2', ':ending[It ends.]')]);

    expect(book).toEqual({
      start: '1',
      sections: [
        { id: '1', choices: ['2'] },
        { id: '2', choices: [], kind: 'ending' },
      ],
    });
  });
});
