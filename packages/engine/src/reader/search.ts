import type { Chapter } from '../types';
import { toPlainText } from '../content/parse';

export interface SearchResult {
  slug: string;
  title: string;
  snippet: string;
}

function makeSnippet(text: string, term: string): string {
  const at = text.toLowerCase().indexOf(term);
  if (at < 0) return `${text.slice(0, 140)}…`;
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + 90);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/** Return chapters (within one book) whose title/text contain all query terms. */
export function searchChapters(chapters: Chapter[], query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const terms = normalized.split(/\s+/);

  const results: SearchResult[] = [];
  for (const chapter of chapters) {
    const text = toPlainText(chapter.markdown);
    const haystack = `${chapter.title}\n${text}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;
    results.push({
      slug: chapter.slug,
      title: chapter.title,
      snippet: makeSnippet(text, terms[0]),
    });
  }
  return results;
}
