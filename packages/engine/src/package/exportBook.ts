import { zipSync, strToU8 } from 'fflate';
import type { Book } from '../types';

/**
 * Package a book as a `.smartbook` zip: `smartbook.json` + content, plus any
 * packaged assets the book carries (imported books re-export their assets).
 */
export function exportBookToZip(book: Book): Uint8Array {
  const { descriptor } = book;

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
