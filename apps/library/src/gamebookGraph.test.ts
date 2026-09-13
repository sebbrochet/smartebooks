import { describe, it, expect } from 'vitest';
import { checkBook, graphOf, sectionOf } from '@smart-ebooks/islands-gamebook';
import { chapterUnits, type Unit } from '@smart-ebooks/engine';
import cellarDoor from '../../../books/gamebook/content/01-the-cellar-door.md?raw';

/**
 * SPEC011 K4 — the argument for this domain paying the platform back: a
 * gamebook is a graph, so a linter can prove something the runtime cannot.
 *
 * It could prove it from the day it was written and had never been given a
 * book, because nothing turned prose into a graph. This is the join, and it is
 * pointed at the bundled demo rather than a fixture: a rule that only ever sees
 * invented input is a rule nobody has checked against a real author.
 */
const units = chapterUnits(cellarDoor, 2).units;

const unit = (id: string, markdown: string): Unit => ({ id, title: id, markdown });

describe('the bundled gamebook', () => {
  it('is playable', () => {
    expect(checkBook(graphOf(units))).toEqual([]);
  });

  // Guards the guard: if the extraction silently found nothing, "playable"
  // above would be a book of no sections, which passes for the wrong reason.
  it('was actually read', () => {
    const graph = graphOf(units);

    expect(graph.start).toBe('1');
    expect(graph.sections).toHaveLength(20);
    expect(graph.sections.filter((section) => section.kind === 'ending')).toHaveLength(7);
    expect(graph.sections.filter((section) => section.kind === 'death')).toHaveLength(1);
  });
});

/**
 * Weighted at the awkward spellings rather than the tidy one: the risk in
 * reading directives with regular expressions is a form they miss, and a
 * missed choice is an edge the linter never checks.
 */
describe('reading a section', () => {
  it('finds a choice however it is written', () => {
    const section = sectionOf(
      unit(
        '1',
        [
          'Plain, :choice{to="2"}.',
          'Labelled, :choice[Open the door]{to="3"}.',
          "Single-quoted, :choice{to='4'}.",
          'Two on one line: :choice{to="5"} or :choice{to="6"}.',
        ].join('\n'),
      ),
    );

    expect(section.choices).toEqual(['2', '3', '4', '5', '6']);
  });

  it('reads a death and where it sends the reader', () => {
    const section = sectionOf(unit('6', 'You stop minding.\n\n:death[*It ends.*]{to="4"}'));

    expect(section).toEqual({ id: '6', choices: [], kind: 'death', respawn: '4' });
  });

  it('reads an ending', () => {
    expect(sectionOf(unit('9', 'The bolt is on your side.\n\n:ending[*It ends.*]')).kind).toBe(
      'ending',
    );
  });

  // A section that offers a way on is not terminal, whatever else it says.
  it('does not call a section an ending because the word appears', () => {
    const section = sectionOf(unit('7', 'Not over yet. :choice{to="8"}. :ending'));

    expect(section.kind).toBeUndefined();
    expect(section.choices).toEqual(['8']);
  });

  it('leaves a section with no way on unmarked, so the linter can object', () => {
    expect(sectionOf(unit('4', 'A room, and nothing else.')).kind).toBeUndefined();
  });
});
