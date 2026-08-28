import { zipSync, strToU8 } from 'fflate';
import type { Book } from '../types';
import type { SmartbookChapterEntry } from './spec';

/**
 * Package a book as a `.smartbook` zip: `smartbook.json` + content, plus any
 * packaged assets the book carries (imported books re-export their assets).
 *
 * The descriptor is rewritten with the book's resolved chapters. Without that,
 * order and titles survive only if they happen to be encoded in filename
 * prefixes — `makeChapters` otherwise gives every chapter `order: 999`, so a
 * round-trip through export/import could silently reorder a book (SPEC003 D7).
 */
export function exportBookToZip(book: Book): Uint8Array {
  const chapters: SmartbookChapterEntry[] = book.chapters.map((chapter) => ({
    file: `${chapter.slug}.md`,
    order: chapter.order,
    title: chapter.title,
  }));

  const descriptor = { ...book.descriptor, chapters };

  const files: Record<string, Uint8Array> = {
    'smartbook.json': strToU8(`${JSON.stringify(descriptor, null, 2)}\n`),
  };
  for (const chapter of book.chapters) {
    files[`content/${chapter.slug}.md`] = strToU8(chapter.markdown);
  }
  if (book.assets) {
    for (const [path, bytes] of Object.entries(book.assets)) {
      files[path] = bytes;
    }
  }

  return zipSync(files, { level: 6 });
}
