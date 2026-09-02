import { zipSync, strToU8 } from 'fflate';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Books big enough for the reader's navigation to be wrong.
 *
 * Every bundled book is three or four chapters long, and that is exactly why
 * two layout bugs survived review: a sidebar with no scrollport of its own and
 * a contents rail that could run off the bottom of the screen are both
 * *invisible* until the list is taller than the viewport (SPEC002 N1, N4).
 * Reasoning about the CSS found them; nothing in the suite could have.
 *
 * **Two shapes, because the two fixes protect different books.** Folding parts
 * away (N2) means a book divided into parts never lists more than one part's
 * worth of chapters, so it rarely overflows — the clamp (N1) is what saves a
 * book that is *flat*, or one whose chapters pile into a single part. A fixture
 * with parts alone reports the clamp as unnecessary, which is how this was
 * found: the first version of this suite did exactly that.
 *
 * Generated rather than authored: committing forty chapters of filler to
 * `books/` would put it on the shelf of a published library and slow every
 * content lint for the life of the project. It is built in the test process and
 * pushed through the ordinary `.smartbook` import path, which has the side
 * benefit of exercising import at a realistic size.
 */

export const LARGE_BOOK = {
  chapters: 44,
  parts: 5,
  /** Sections in chapter 1, chosen to overflow the contents rail comfortably. */
  sectionsInFirstChapter: 60,
};

/** Distinct enough that a locator cannot match two of them by accident. */
export function chapterTitle(index: number): string {
  return `${index}. Chapter number ${index}`;
}

export function partTitle(index: number): string {
  return `Division ${index} of the work`;
}

export function sectionTitle(index: number): string {
  return `Section ${index} heading`;
}

function chapterMarkdown(index: number, sections: number): string {
  const lines = [`# ${chapterTitle(index)}`, '', `Opening prose for chapter ${index}.`, ''];

  for (let s = 1; s <= sections; s += 1) {
    lines.push(`## ${sectionTitle(s)}`, '');
    // A distinctive term per chapter, so a search can be asserted to find
    // exactly one of forty-four.
    lines.push(`Body text for section ${s}. Marker term chapter${index}unique.`, '');
  }

  return lines.join('\n');
}

export interface LargeBookOptions {
  title: string;
  /** Zero means a flat book: no parts, every chapter in one long list. */
  parts: number;
}

/** Writes the package to a temp file and returns its path. */
export function makeLargeBookFile({ title, parts: partCount }: LargeBookOptions): string {
  const parts = Array.from({ length: partCount }, (_, i) => ({
    id: `part-${i + 1}`,
    title: partTitle(i + 1),
  }));

  const files: Record<string, Uint8Array> = {};
  const chapters: { file: string; order: number; part?: string }[] = [];

  for (let i = 1; i <= LARGE_BOOK.chapters; i += 1) {
    const file = `${String(i).padStart(2, '0')}-chapter.md`;
    // Spread evenly, so the active part is never the only populated one.
    const part = partCount
      ? parts[Math.floor(((i - 1) / LARGE_BOOK.chapters) * partCount)].id
      : undefined;
    chapters.push(part ? { file, order: i, part } : { file, order: i });

    const sections = i === 1 ? LARGE_BOOK.sectionsInFirstChapter : 3;
    files[`content/${file}`] = strToU8(chapterMarkdown(i, sections));
  }

  files['smartbook.json'] = strToU8(
    JSON.stringify({
      schemaVersion: 1,
      slug: `stress-${partCount}-parts`,
      title,
      description: 'Generated for layout tests. Not a real book.',
      visibility: 'public',
      ...(partCount ? { parts } : {}),
      chapters,
    }),
  );

  const path = join(tmpdir(), `smart-ebook-large-${partCount}-${Date.now()}.smartbook.zip`);
  // The path is built from `tmpdir()` and a timestamp and never touches user
  // input, so the non-literal-filename rule has nothing to protect here.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, zipSync(files));
  return path;
}
