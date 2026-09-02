import type { Chapter } from '../types';
import { chapterPassages, type Heading } from '../markdown/headings';

/**
 * A passage-level index of one book.
 *
 * Replaces the linear scan that answered "which chapters contain all of these
 * words" with something that can answer "where, and which of those is most
 * likely what you meant" (SPEC002 R1.2, N10/N11/N15/N17).
 *
 * **Built at read time, not at build time**, which is a correction to R1.2 as
 * written. An index shipped inside the package cannot be the only mechanism,
 * because a `.smartbook` is a portable format: one exported by another tool, or
 * hand-assembled, arrives with no index and must still be searchable. A reader
 * that depends on a packaged artefact has two code paths and a silent
 * second-class experience for exactly the books it does not control. Packaging
 * a prebuilt index remains worthwhile later — as an *optimisation over* this,
 * not instead of it.
 */

export interface IndexedPassage {
  chapterSlug: string;
  chapterTitle: string;
  heading?: Heading;
  text: string;
}

export interface BookIndex {
  passages: IndexedPassage[];
  /** term → passage position → how often it occurs there. */
  postings: Map<string, Map<number, number>>;
  /** Every term, sorted, so a prefix is a contiguous range. */
  terms: string[];
}

/**
 * Words, for indexing and for querying — the same function for both, because a
 * query tokenised differently from the text can never match it.
 *
 * Unicode-aware: `\w` would split "café" into "caf" and cut "über" in half,
 * which matters for the French and Spanish books this platform is aimed at.
 */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function buildIndex(chapters: Chapter[]): BookIndex {
  const passages: IndexedPassage[] = [];
  const postings = new Map<string, Map<number, number>>();

  for (const chapter of chapters) {
    for (const passage of chapterPassages(chapter.markdown)) {
      const position = passages.length;
      passages.push({
        chapterSlug: chapter.slug,
        chapterTitle: chapter.title,
        heading: passage.heading,
        text: passage.text,
      });

      // The chapter title is indexed into every one of its passages, and the
      // heading into its own: a reader searching a chapter's or a section's
      // name expects to find it, and neither is part of the body text.
      const searchable = `${chapter.title} ${passage.heading?.text ?? ''} ${passage.text}`;
      for (const term of tokenize(searchable)) {
        let byPassage = postings.get(term);
        if (!byPassage) postings.set(term, (byPassage = new Map()));
        byPassage.set(position, (byPassage.get(position) ?? 0) + 1);
      }
    }
  }

  return { passages, postings, terms: [...postings.keys()].sort() };
}

/** The terms beginning with `prefix`, found by bisecting the sorted list. */
export function termsWithPrefix(index: BookIndex, prefix: string): string[] {
  const { terms } = index;
  let low = 0;
  let high = terms.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (terms[mid] < prefix) low = mid + 1;
    else high = mid;
  }

  const found: string[] = [];
  for (let i = low; i < terms.length && terms[i].startsWith(prefix); i += 1) found.push(terms[i]);
  return found;
}

/**
 * The completion to offer for a half-typed word (N17).
 *
 * The term appearing in the most passages, not the shortest or the first
 * alphabetically: a completion is a guess about intent, and frequency is the
 * only evidence the index has. Ties break alphabetically so the suggestion
 * never flickers between two equals.
 */
export function completeTerm(index: BookIndex, prefix: string): string | undefined {
  if (!prefix) return undefined;

  let best: string | undefined;
  let bestCount = -1;
  for (const term of termsWithPrefix(index, prefix)) {
    if (term === prefix) continue;
    const count = index.postings.get(term)?.size ?? 0;
    if (count > bestCount || (count === bestCount && best !== undefined && term < best)) {
      best = term;
      bestCount = count;
    }
  }
  return best;
}

export interface PassageHit {
  heading?: Heading;
  snippet: string;
  score: number;
}

export interface ChapterHit {
  slug: string;
  title: string;
  score: number;
  passages: PassageHit[];
}

export interface SearchOutcome {
  chapters: ChapterHit[];
  /** Passages matched, which is what the reader is really being offered. */
  passageCount: number;
  /** The terms actually searched for, after prefix expansion. */
  terms: string[];
}

const TITLE_BOOST = 8;
const HEADING_BOOST = 4;

/**
 * Search the index.
 *
 * **Every term must match, and the last one matches as a prefix.** That single
 * asymmetry is what makes typing feel like search rather than like filling in a
 * form: "gover" finds "governance" while the reader is still typing it, but
 * "gover ai" does not quietly match every passage containing "ai".
 */
export function queryIndex(index: BookIndex, query: string): SearchOutcome {
  const typed = tokenize(query);
  if (typed.length === 0) return { chapters: [], passageCount: 0, terms: [] };

  const empty: SearchOutcome = { chapters: [], passageCount: 0, terms: [] };
  const scores = new Map<number, number>();
  const matchedTerms = new Set<string>();

  for (let position = 0; position < typed.length; position += 1) {
    const term = typed[position];
    const isLast = position === typed.length - 1;
    const expansions = isLast
      ? termsWithPrefix(index, term)
      : index.postings.has(term)
        ? [term]
        : [];

    // Every term is required, so one that matches nothing ends the search.
    if (expansions.length === 0) return empty;

    const reached = new Map<number, number>();
    for (const expansion of expansions) {
      matchedTerms.add(expansion);
      for (const [passage, count] of index.postings.get(expansion) ?? []) {
        reached.set(passage, (reached.get(passage) ?? 0) + count);
      }
    }

    if (position === 0) {
      for (const [passage, count] of reached) scores.set(passage, count);
      continue;
    }

    // Intersect: a surviving passage must have carried every earlier term too.
    for (const [passage, running] of [...scores]) {
      const count = reached.get(passage);
      if (count === undefined) scores.delete(passage);
      else scores.set(passage, running + count);
    }
  }

  const terms = [...matchedTerms];
  const byChapter = new Map<string, ChapterHit>();

  for (const [position, frequency] of scores) {
    const passage = index.passages[position];

    // Where a word appears is worth more than how often. A term in a chapter's
    // title or a section's heading is what that section is *about*; the same
    // term buried in a paragraph may be an aside.
    let score = frequency;
    if (containsAny(passage.chapterTitle, terms)) score += TITLE_BOOST;
    if (passage.heading && containsAny(passage.heading.text, terms)) score += HEADING_BOOST;

    let chapter = byChapter.get(passage.chapterSlug);
    if (!chapter) {
      chapter = { slug: passage.chapterSlug, title: passage.chapterTitle, score: 0, passages: [] };
      byChapter.set(passage.chapterSlug, chapter);
    }

    chapter.passages.push({
      heading: passage.heading,
      snippet: snippet(passage.text, terms),
      score,
    });
    // The chapter is as good as its best passage, not the sum of its length —
    // otherwise a long weak chapter outranks a short exact one.
    chapter.score = Math.max(chapter.score, score);
  }

  const chapters = [...byChapter.values()].sort(byScoreThenTitle);
  for (const chapter of chapters) chapter.passages.sort(byScoreDescending);

  return { chapters, passageCount: scores.size, terms };
}

function byScoreDescending(a: { score: number }, b: { score: number }): number {
  return b.score - a.score;
}

function byScoreThenTitle(a: ChapterHit, b: ChapterHit): number {
  return b.score - a.score || a.title.localeCompare(b.title);
}

function containsAny(text: string, terms: string[]): boolean {
  const words = new Set(tokenize(text));
  return terms.some((term) => words.has(term));
}

/** A window of text around the earliest term that actually occurs. */
function snippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  if (positions.length === 0) return text.slice(0, 140);

  const at = Math.min(...positions);
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + 100);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
