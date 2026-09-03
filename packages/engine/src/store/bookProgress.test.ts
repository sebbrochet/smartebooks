import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Book } from '../types';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { navSections } from '../reader/navSections';

// jsdom has no IndexedDB. Keyed per store, for the reason republish.test.ts
// records: merging them makes reader state answer questions about packages.
const { banks } = vi.hoisted(() => ({ banks: new Map<string, Map<string, unknown>>() }));

function bank(store?: string): Map<string, unknown> {
  const name = store ?? 'default';
  if (!banks.has(name)) banks.set(name, new Map());
  return banks.get(name) as Map<string, unknown>;
}

vi.mock('idb-keyval', () => ({
  createStore: (db: string, name: string) => `${db}/${name}`,
  get: async (key: string, store?: string) => bank(store).get(key),
  set: async (key: string, value: unknown, store?: string) => {
    bank(store).set(key, value);
  },
  del: async (key: string, store?: string) => {
    bank(store).delete(key);
  },
  values: async (store?: string) => [...bank(store).values()],
  entries: async (store?: string) => [...bank(store).entries()],
}));

const { readPartProgress, findSection } = await import('./bookProgress');
const { scores, progress } = await import('./store');

beforeEach(() => banks.clear());

const registry = createIslandRegistry(defaultIslands);

function quiz(id: string, questions: number): string {
  const body = Array.from(
    { length: questions },
    (_, i) => `\n### Question ${i + 1}?\n\n- [x] Yes\n- [ ] No\n`,
  ).join('');
  return `:::quiz{id="${id}"}\n${body}\n:::\n`;
}

/** A two-part book: one exam track of two chapters, one annexe. */
function book(): Book {
  return {
    meta: { slug: 'guide', title: 'A Guide' },
    chapters: [
      {
        slug: '01-one',
        order: 1,
        title: 'One',
        part: 'track',
        markdown: `# One\n\n${quiz('q-one', 3)}`,
      },
      {
        slug: '02-two',
        order: 2,
        title: 'Two',
        part: 'track',
        markdown: `# Two\n\n${quiz('q-two', 2)}:::checkpoint{id="c-two"}\n:::\n`,
      },
      {
        slug: '03-annexe',
        order: 3,
        title: 'Annexe',
        part: 'annexes',
        markdown: '# Annexe\n\nNo quiz.\n',
      },
    ],
    descriptor: {
      schemaVersion: 2,
      slug: 'guide',
      title: 'A Guide',
      visibility: 'public',
      parts: [
        { id: 'track', title: 'Track One' },
        { id: 'annexes', title: 'Annexes' },
      ],
    },
    islands: defaultIslands,
  } as unknown as Book;
}

const section = (id: string) => findSection(book(), id)!;

describe('readPartProgress', () => {
  /**
   * The join this exists for: a score is stored under the quiz's id, and only
   * the Markdown knows which chapter that quiz is in.
   */
  it('attributes a score to the chapter whose quiz earned it', async () => {
    await scores.record('guide', 'q-one', { score: 2, total: 3, attempts: 1 });

    const part = await readPartProgress(book(), registry, section('track'));

    expect(part.title).toBe('Track One');
    expect(part.chapters.map((c) => c.slug)).toEqual(['01-one', '02-two']);
    expect(part.chapters[0]).toMatchObject({ score: 2, points: 3, quizzes: 1, quizzesTaken: 1 });
    expect(part.chapters[1]).toMatchObject({ score: 0, points: 2, quizzes: 1, quizzesTaken: 0 });
  });

  /** The part total is what says which track the reader is weak on. */
  it('sums its chapters', async () => {
    await scores.record('guide', 'q-one', { score: 3, total: 3, attempts: 1 });
    await scores.record('guide', 'q-two', { score: 1, total: 2, attempts: 2 });

    const part = await readPartProgress(book(), registry, section('track'));

    expect(part).toMatchObject({ score: 4, points: 5, quizzes: 2, quizzesTaken: 2 });
  });

  /**
   * Points are known before anything is answered, which is the difference
   * between "you have taken no quizzes" and "there are 5 points here".
   */
  it('reports the points available before a single quiz is taken', async () => {
    const part = await readPartProgress(book(), registry, section('track'));
    expect(part).toMatchObject({ score: 0, points: 5, quizzes: 2, quizzesTaken: 0 });
  });

  it('counts a completed checkpoint, and ignores one never ticked', async () => {
    const before = await readPartProgress(book(), registry, section('track'));
    expect(before.chapters[1]).toMatchObject({ checkpoints: 1, checkpointsComplete: 0 });

    await progress.setComplete('guide', 'c-two', true);

    const after = await readPartProgress(book(), registry, section('track'));
    expect(after.chapters[1]).toMatchObject({ checkpoints: 1, checkpointsComplete: 1 });
  });

  it('reports a part whose chapters ask nothing without inventing a denominator', async () => {
    const part = await readPartProgress(book(), registry, section('annexes'));
    expect(part).toMatchObject({ score: 0, points: 0, quizzes: 0 });
    expect(part.chapters[0]).toMatchObject({ quizzes: 0, points: 0 });
  });

  /**
   * A score recorded against an older edition can carry a `total` the current
   * chapter no longer has. Reporting the stored score against the current
   * denominator would show 4/3; the reader would rightly not believe any of it.
   */
  it('never lets a stale score exceed what the chapter is worth', async () => {
    await scores.record('guide', 'q-one', { score: 4, total: 4, attempts: 1 });

    const part = await readPartProgress(book(), registry, section('track'));

    expect(part.chapters[0].score).toBeLessThanOrEqual(part.chapters[0].points);
  });

  it('does not read another book’s scores', async () => {
    await scores.record('other-book', 'q-one', { score: 3, total: 3, attempts: 1 });

    const part = await readPartProgress(book(), registry, section('track'));

    expect(part.score).toBe(0);
  });
});

describe('findSection', () => {
  it('returns nothing for a part the book does not declare', () => {
    expect(findSection(book(), 'no-such-part')).toBeUndefined();
  });

  it('groups the same way the sidebar does', () => {
    const sections = navSections(book().chapters, book().descriptor.parts);
    expect(findSection(book(), 'track')).toEqual(sections.find((s) => s.id === 'track'));
  });
});
