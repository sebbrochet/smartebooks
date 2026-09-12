import { describe, it, expect } from 'vitest';
import { checkBook, type BookSpec, type SectionSpec } from './check';

const section = (id: string, choices: string[], rest: Partial<SectionSpec> = {}): SectionSpec => ({
  id,
  choices,
  ...rest,
});

/** A tiny playable book: 1 → 2 → 3(end), with 2 → 4(death) respawning at 2. */
const playable = (): BookSpec => ({
  start: '1',
  sections: [
    section('1', ['2']),
    section('2', ['3', '4']),
    section('3', [], { kind: 'ending' }),
    section('4', [], { kind: 'death', respawn: '2' }),
  ],
});

const rulesOf = (book: BookSpec) => checkBook(book).map((problem) => problem.rule);

describe('a playable book', () => {
  it('has nothing to report', () => {
    expect(checkBook(playable())).toEqual([]);
  });
});

describe('the graph', () => {
  // K4.1. Printed gamebooks historically shipped with broken cross-references;
  // this is the one domain where that is the headline bug.
  it('refuses a choice that leads nowhere', () => {
    const book = playable();
    book.sections[0].choices = ['404'];

    expect(rulesOf(book)).toContain('choice-target');
    // ...and "2" is now unreachable, which is the same mistake seen downstream.
    expect(rulesOf(book)).toContain('unreachable');
  });

  it('refuses two sections with one id', () => {
    const book = playable();
    book.sections.push(section('2', ['3']));

    expect(rulesOf(book)).toContain('duplicate-id');
  });

  it('refuses a start that does not exist', () => {
    const book = playable();
    book.start = '0';

    expect(rulesOf(book)).toContain('start-missing');
  });

  // K4.4. A section the reader can enter and never leave.
  it('refuses a section that offers nothing and does not say why', () => {
    const book = playable();
    book.sections[2] = section('3', []);

    expect(rulesOf(book)).toContain('dead-end');
  });

  it('accepts a terminal section that says what it is', () => {
    const book = playable();
    book.sections[2] = section('3', [], { kind: 'ending' });

    expect(rulesOf(book)).not.toContain('dead-end');
  });

  // QG5: a warning, because an author may be mid-draft and an unreachable
  // section can be an easter egg reached by means the linter cannot see.
  it('warns about an orphan rather than failing on it', () => {
    const book = playable();
    book.sections.push(section('99', [], { kind: 'ending' }));

    const orphan = checkBook(book).find((problem) => problem.section === '99');
    expect(orphan?.rule).toBe('unreachable');
    expect(orphan?.severity).toBe('warning');
  });
});

describe('respawn', () => {
  // K4.6, and the whole reason it exists: QG13 said the runtime has no good
  // answer when a reader is respawned somewhere they have never been. The graph
  // can prove that away.
  it('refuses a respawn a reader could have skipped', () => {
    const book: BookSpec = {
      start: '1',
      sections: [
        // Two roads to the death, and the respawn is only on one of them.
        section('1', ['2', '3']),
        section('2', ['4']),
        section('3', ['4']),
        section('4', [], { kind: 'death', respawn: '2' }),
      ],
    };

    expect(rulesOf(book)).toContain('respawn-unreachable');
  });

  it('accepts a respawn every road passes through', () => {
    const book: BookSpec = {
      start: '1',
      sections: [
        section('1', ['2']),
        section('2', ['3', '5']),
        section('3', ['4']),
        section('5', ['4']),
        section('4', [], { kind: 'death', respawn: '2' }),
      ],
    };

    expect(rulesOf(book)).not.toContain('respawn-unreachable');
  });

  it('lets the book name a default, and the section override it', () => {
    const book = playable();
    book.respawn = '1';
    delete book.sections[3].respawn;
    expect(rulesOf(book)).toEqual([]);

    book.sections[3].respawn = '3'; // an ending nobody passes through
    expect(rulesOf(book)).toContain('respawn-unreachable');
  });

  it('refuses a death with no respawn anywhere', () => {
    const book = playable();
    delete book.sections[3].respawn;

    expect(rulesOf(book)).toContain('respawn-missing');
  });

  it('refuses a respawn that does not exist', () => {
    const book = playable();
    book.sections[3].respawn = '500';

    expect(rulesOf(book)).toContain('respawn-missing');
  });

  it('asks nothing of an ending', () => {
    const book = playable();
    book.sections[3] = section('4', [], { kind: 'ending' });

    expect(checkBook(book)).toEqual([]);
  });
});

describe('names a book declares', () => {
  // K4.5.
  it('refuses a condition testing something undeclared', () => {
    const book = playable();
    book.sections[1].conditions = [{ kind: 'item', item: 'silver key' }];

    expect(rulesOf(book)).toContain('unknown-name');
  });

  it('accepts every kind of name once declared', () => {
    const book = playable();
    book.items = ['silver key'];
    book.flags = ['freed the prisoner'];
    book.stats = ['stamina'];
    book.sections[1].conditions = [
      { kind: 'item', item: 'silver key' },
      { kind: 'flag', flag: 'freed the prisoner' },
      { kind: 'stat', stat: 'stamina', bound: 'atLeast', value: 6 },
    ];

    expect(checkBook(book)).toEqual([]);
  });

  it('says which pool it looked in', () => {
    const book = playable();
    book.sections[1].conditions = [{ kind: 'stat', stat: 'luck', bound: 'atLeast', value: 1 }];

    expect(checkBook(book)[0].message).toContain('stat "luck"');
  });
});
