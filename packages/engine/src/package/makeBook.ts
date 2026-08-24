import type { Book, Chapter } from '../types';
import type { IslandDefinition } from '../islandRegistry';
import { extractTitle } from '../content/parse';
import { makeChapters } from '../content/makeChapters';
import type { SmartbookChapterEntry, SmartbookDescriptor } from './spec';

function moduleByFile(modules: Record<string, string>, file: string): string | undefined {
  const match = Object.entries(modules).find(([path]) => path.split('/').pop() === file);
  return match?.[1];
}

function chaptersFromDescriptor(
  entries: SmartbookChapterEntry[],
  modules: Record<string, string>,
): Chapter[] {
  return entries
    .map((entry, index) => {
      const markdown = moduleByFile(modules, entry.file) ?? '';
      const slug = entry.file.replace(/\.md$/, '');
      const prefix = slug.match(/^(\d+)/);
      const order = entry.order ?? (prefix ? Number.parseInt(prefix[1], 10) : index);
      const title = entry.title ?? extractTitle(markdown, slug);
      return { slug, order, title, markdown };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Build a `Book` from a `smartbook.json` descriptor plus a Vite glob of the
 * book's raw Markdown, scoped to the `islands` it declares. If the descriptor
 * lists chapters they drive order/titles; otherwise chapters are derived from
 * the content folder. The descriptor is attached to the book so it can be
 * re-exported faithfully.
 */
export function makeBook(
  descriptor: SmartbookDescriptor,
  modules: Record<string, string>,
  islands: IslandDefinition[],
): Book {
  const chapters =
    descriptor.chapters && descriptor.chapters.length > 0
      ? chaptersFromDescriptor(descriptor.chapters, modules)
      : makeChapters(modules);

  return {
    meta: {
      slug: descriptor.slug,
      title: descriptor.title,
      description: descriptor.description,
      cover: descriptor.cover,
      authors: descriptor.authors,
    },
    chapters,
    descriptor,
    islands,
  };
}
