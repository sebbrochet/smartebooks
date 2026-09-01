import type { Chapter } from '../types';
import { toPlainText } from '../content/parse';

export interface SearchResult {
  slug: string;
  title: string;
  snippet: string;
  /** The query's terms, so a view can mark them without re-deriving them. */
  terms: string[];
}

/**
 * A book's text, parsed once.
 *
 * `toPlainText` used to run *inside* the result loop, so every query re-parsed
 * every chapter's Markdown. That was tolerable while search was a page you
 * pressed Enter to reach; it is not once results update per keystroke, which
 * re-parses the whole book on every letter typed (SPEC002 S2).
 *
 * This is **not** the index R1.2 asks for — there is still no ranking, no
 * stemming, and a result is a chapter rather than a passage. It removes only
 * the repeated parse, which is the part that scales with typing speed.
 */
export interface SearchCorpus {
  entries: { slug: string; title: string; text: string; haystack: string }[];
}

export function buildCorpus(chapters: Chapter[]): SearchCorpus {
  return {
    entries: chapters.map((chapter) => {
      const text = toPlainText(chapter.markdown);
      return {
        slug: chapter.slug,
        title: chapter.title,
        text,
        haystack: `${chapter.title}\n${text}`.toLowerCase(),
      };
    }),
  };
}

export function queryTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  return normalized ? normalized.split(/\s+/) : [];
}

/** Chapters whose title or text contains every term of the query. */
export function searchCorpus(corpus: SearchCorpus, query: string): SearchResult[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];
  for (const entry of corpus.entries) {
    if (!terms.every((term) => entry.haystack.includes(term))) continue;
    results.push({
      slug: entry.slug,
      title: entry.title,
      snippet: makeSnippet(entry.text, terms),
      terms,
    });
  }
  return results;
}

/** Convenience for callers holding chapters rather than a parsed corpus. */
export function searchChapters(chapters: Chapter[], query: string): SearchResult[] {
  return searchCorpus(buildCorpus(chapters), query);
}

/**
 * A window of text around the match.
 *
 * Centred on the **earliest term that actually occurs**, not on the first term
 * typed: a query whose first word appears only in the title would otherwise
 * show the opening of the chapter and read like a false positive.
 */
function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  if (positions.length === 0) return `${text.slice(0, 140)}…`;

  const at = Math.min(...positions);
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + 90);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * Splits text into matched and unmatched runs, so a view can mark the terms
 * without building HTML out of a string.
 *
 * Overlapping matches are **merged rather than nested**: two terms sharing
 * characters would otherwise produce a `<mark>` inside a `<mark>`, which reads
 * as a darker patch for no reason a reader could explain.
 */
export function highlight(text: string, terms: string[]): TextPart[] {
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];

  for (const term of terms) {
    if (!term) continue;
    let from = lower.indexOf(term);
    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = lower.indexOf(term, from + term.length);
    }
  }

  if (ranges.length === 0) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [from, to] of ranges) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }

  const parts: TextPart[] = [];
  let cursor = 0;
  for (const [from, to] of merged) {
    if (from > cursor) parts.push({ text: text.slice(cursor, from), match: false });
    parts.push({ text: text.slice(from, to), match: true });
    cursor = to;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });

  return parts;
}
