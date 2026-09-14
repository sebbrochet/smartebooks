import { describe, it, expect } from 'vitest';
import { checkBook, graphOf, sectionOf } from '@smart-ebooks/islands-gamebook';
import { chapterUnits, type Unit } from '@smart-ebooks/engine';
import cellarDoor from '../../../books/gamebook/content/01-the-cellar-door.md?raw';
import kitchenWindow from '../../../books/gamebook/content/02-the-kitchen-window.md?raw';

/**
 * SPEC011 K4 — the argument for this domain paying the platform back: a
 * gamebook is a graph, so a linter can prove something the runtime cannot.
 *
 * It could prove it from the day it was written and had never been given a
 * book, because nothing turned prose into a graph. This is the join, and it is
 * pointed at the bundled demo rather than a fixture: a rule that only ever sees
 * invented input is a rule nobody has checked against a real author.
 *
 * **Assembled from every chapter**, because the book spans two files and its
 * sections are numbered straight through them. Checking one file at a time
 * would report every choice that leaves it as a broken target — worse than not
 * checking, because the author would learn to ignore it.
 */
const units = [cellarDoor, kitchenWindow].flatMap((markdown) => chapterUnits(markdown, 2).units);

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

  /**
   * The reason the assembly above has to be book-wide. Section 8 is in the
   * first file and both of its choices land in the second, so a per-file check
   * would call them broken and a per-file reader could not follow them.
   */
  it('has choices that cross a file boundary', () => {
    const first = new Set(chapterUnits(cellarDoor, 2).units.map((each) => each.id));
    const eight = graphOf(units).sections.find((section) => section.id === '8');

    expect(eight?.choices).toEqual(['11', '12']);
    expect(eight?.choices.some((target) => first.has(target))).toBe(false);
  });

  // Every section is numbered once across the whole book, which is what lets a
  // link name 217 without naming the file it is filed in.
  it('numbers its sections once across both files', () => {
    const ids = units.map((each) => each.id);

    expect(new Set(ids).size).toBe(ids.length);
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
