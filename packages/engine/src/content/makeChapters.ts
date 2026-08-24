import type { Chapter } from '../types';
import { extractTitle } from './parse';

/**
 * Build an ordered list of chapters from a Vite glob of raw Markdown modules.
 * Books call this with `import.meta.glob('./content/*.md', { query: '?raw',
 * import: 'default', eager: true })`. Order and slug come from the filename.
 */
export function makeChapters(modules: Record<string, string>): Chapter[] {
  return Object.entries(modules)
    .map(([path, markdown]) => {
      const file = path.split('/').pop() ?? '';
      const slug = file.replace(/\.md$/, '');
      const match = slug.match(/^(\d+)/);
      const order = match ? Number.parseInt(match[1], 10) : 999;
      return { slug, order, title: extractTitle(markdown, slug), markdown };
    })
    .sort((a, b) => a.order - b.order);
}
