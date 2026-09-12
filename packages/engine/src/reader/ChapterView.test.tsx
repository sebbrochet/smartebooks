import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry } from '../islandRegistry';
import { defaultIslands } from '../islands/defaults';
import { BookProvider, useBook } from './BookContext';
import { ChapterView } from './ChapterView';
import type { Book, Chapter } from '../types';
import type { SmartbookDescriptor } from '../package/spec';

/** Reports what an island can see of where it is (SPEC001 L17 / SPEC011 B9). */
function Where() {
  const { unit } = useBook();
  return <p>where:{unit ?? 'nowhere'}</p>;
}

const registry = createIslandRegistry([...defaultIslands, { name: 'where', component: Where }]);

const markdown = [
  '# The Caves',
  '',
  'You stand at the mouth of the cave.',
  '',
  '## 1',
  '',
  'A door stands ajar.',
  '',
  '::where',
  '',
  '## 2',
  '',
  'You are eaten by a grue.',
  '',
  '::where',
].join('\n');

const chapter: Chapter = { slug: '01-caves', order: 1, title: 'The Caves', markdown };

function bookWith(unitDepth?: number): Book {
  const descriptor = {
    schemaVersion: 1,
    slug: 'caves',
    title: 'The Caves',
    ...(unitDepth ? { unitDepth } : {}),
  } as SmartbookDescriptor;

  return {
    meta: { slug: 'caves', title: 'The Caves' },
    chapters: [chapter],
    descriptor,
    islands: [],
  };
}

function html(book: Book, section?: string) {
  return renderToStaticMarkup(
    <BookProvider slug="caves" trusted registry={registry}>
      <ChapterView
        book={book}
        basePath="/caves"
        chapter={chapter}
        registry={registry}
        section={section}
      />
    </BookProvider>,
  );
}

describe('a book whose files are pages', () => {
  it('renders the whole file, as every book has until now', () => {
    const output = html(bookWith());

    expect(output).toContain('A door stands ajar');
    expect(output).toContain('You are eaten');
    expect(output).toContain('You stand at the mouth');
  });
});

describe('a book whose files carry units', () => {
  /**
   * The point of SPEC005 M2, and the whole of SPEC011 B2: hiding the links
   * leaves every section in the DOM, where a reader can scroll into the ending
   * and Ctrl+F finds it. Only *not rendering* section 2 withholds it.
   */
  it('delivers the section asked for and not the rest of the file', () => {
    const output = html(bookWith(2), '1');

    expect(output).toContain('A door stands ajar');
    expect(output).not.toContain('You are eaten');
  });

  it('delivers a different section on request', () => {
    const output = html(bookWith(2), '2');

    expect(output).toContain('You are eaten');
    expect(output).not.toContain('A door stands ajar');
  });

  it('opens at the first unit when the route names none', () => {
    const output = html(bookWith(2));

    expect(output).toContain('A door stands ajar');
    expect(output).not.toContain('You are eaten');
  });

  // Forgiving runtime: an unreadable `?s=` costs the reader their place, not
  // the chapter. Whether they may *have* that unit is the book's question.
  it('falls back to the first unit rather than a blank page', () => {
    const output = html(bookWith(2), 'no-such-section');

    expect(output).toContain('A door stands ajar');
  });

  it('keeps rendering the file when it carries no units at that depth', () => {
    const flat: Book = { ...bookWith(4) };
    const output = renderToStaticMarkup(
      <BookProvider slug="caves" trusted registry={registry}>
        <ChapterView book={flat} basePath="/caves" chapter={chapter} registry={registry} />
      </BookProvider>,
    );

    expect(output).toContain('A door stands ajar');
    expect(output).toContain('You are eaten');
  });
});

/**
 * SPEC001 L17 / SPEC011 B9. An island could see `{ slug, trusted, resolveAsset,
 * registry }` and nothing else, so a pack had no way to tell a section the
 * reader is *on* from one they are re-reading — the domain's first hard
 * dependency on the engine rather than on the shell.
 */
describe('what an island can see of where it is', () => {
  it('names the unit it is rendered in', () => {
    expect(html(bookWith(2), '1')).toContain('where:1');
    expect(html(bookWith(2), '2')).toContain('where:2');
  });

  // The unit the view settled on, not the one the route asked for: `?s=` may
  // name a unit the book does not have, and an island must not be told it is
  // somewhere it is not.
  it('names the unit actually delivered, not the one requested', () => {
    expect(html(bookWith(2), 'no-such-section')).toContain('where:1');
  });

  // A book whose files are pages has no unit to be in, and saying so is better
  // than inventing one from the chapter.
  it('says nowhere when the book has no units', () => {
    const output = html(bookWith());

    expect(output).toContain('where:nowhere');
    expect(output).not.toContain('where:1');
  });
});
