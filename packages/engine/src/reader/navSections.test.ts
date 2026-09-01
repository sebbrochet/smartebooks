import { describe, it, expect } from 'vitest';
import type { Chapter } from '../types';
import { navSections } from './navSections';

const chapter = (slug: string, order: number, part?: string): Chapter => ({
  slug,
  order,
  title: slug,
  part,
  markdown: '',
});

const parts = [
  { id: 'one', title: 'Part I' },
  { id: 'two', title: 'Part II' },
];

describe('navSections', () => {
  // One code path for every book, rather than "if the book has parts…".
  it('gives a book with no parts a single untitled section', () => {
    const sections = navSections([chapter('a', 1), chapter('b', 2)]);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBeUndefined();
    expect(sections[0].chapters.map((c) => c.slug)).toEqual(['a', 'b']);
  });

  it('groups chapters under the part they name', () => {
    const sections = navSections(
      [chapter('a', 1, 'one'), chapter('b', 2, 'one'), chapter('c', 3, 'two')],
      parts,
    );

    expect(sections.map((s) => s.title)).toEqual(['Part I', 'Part II']);
    expect(sections[0].chapters.map((c) => c.slug)).toEqual(['a', 'b']);
  });

  // A preface and an appendix are the reason `part` is optional.
  it('leaves ungrouped chapters loose, wherever they sit', () => {
    const sections = navSections(
      [chapter('preface', 0), chapter('a', 1, 'one'), chapter('appendix', 9)],
      parts,
    );

    expect(sections.map((s) => s.title)).toEqual([undefined, 'Part I', undefined]);
    expect(sections[0].chapters.map((c) => c.slug)).toEqual(['preface']);
    expect(sections[2].chapters.map((c) => c.slug)).toEqual(['appendix']);
  });

  // The forgiving half of the contract: `part-unknown` tells the author, and
  // the reader still gets the chapter.
  it('keeps a chapter whose part does not exist', () => {
    const sections = navSections([chapter('a', 1, 'nonsense')], parts);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBeUndefined();
    expect(sections[0].chapters.map((c) => c.slug)).toEqual(['a']);
  });

  it('draws no heading for a part no chapter claims', () => {
    const sections = navSections([chapter('a', 1, 'two')], parts);

    expect(sections.map((s) => s.title)).toEqual(['Part II']);
  });

  // Reading order wins over declaration order: the author can see one of them
  // in the book, and it is this one.
  it('orders parts by where their first chapter falls', () => {
    const sections = navSections([chapter('a', 1, 'two'), chapter('b', 2, 'one')], parts);

    expect(sections.map((s) => s.title)).toEqual(['Part II', 'Part I']);
  });

  it('does not jump backwards when a part is returned to', () => {
    const sections = navSections(
      [chapter('a', 1, 'one'), chapter('b', 2, 'two'), chapter('c', 3, 'one')],
      parts,
    );

    expect(sections.map((s) => s.title)).toEqual(['Part I', 'Part II', 'Part I']);
    expect(sections[2].chapters.map((c) => c.slug)).toEqual(['c']);
  });
});
