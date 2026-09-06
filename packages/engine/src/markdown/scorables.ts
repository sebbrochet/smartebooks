import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { IslandRegistry } from '../islandRegistry';
import type { Book, QuizQuestion } from '../types';

/**
 * Something in a chapter the reader can be measured against.
 *
 * The store knows a reader scored 3 out of 4 on `score:tokens-quiz`; it does
 * **not** know which chapter that quiz is in, because a key is
 * `smart-ebooks:<book>:score:<id>` and nothing in it names a chapter. That
 * mapping only exists in the Markdown, which is why this walks the content
 * rather than reading it back out of the store.
 *
 * `points` is the denominator the reader has not earned yet: a quiz is worth
 * one point per question, so a chapter can say "0 of 12" before anything is
 * attempted. Counting quizzes alone would report "0 of 3" and understate how
 * much of the chapter is actually being tested.
 */
export interface Scorable {
  kind: 'quiz' | 'checkpoint';
  id: string;
  points: number;
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

interface DirectiveLike {
  type: string;
  name: string;
  attributes?: Record<string, unknown> | null;
}

/**
 * The quizzes and checkpoints in one chapter, in document order.
 *
 * Names are resolved **through the book's registry**, so a book still using an
 * older spelling is counted rather than quietly ignored — the registry is the
 * one place that knows an alias, and duplicating its table here is how the two
 * would drift.
 *
 * An island with no `id` is skipped. The linter already rejects a stateful
 * island without one, because they would all write to the same key; here it
 * would additionally mean counting a denominator against a score that can
 * never be attributed to it.
 */
export function chapterScorables(markdown: string, registry: IslandRegistry): Scorable[] {
  const found: Scorable[] = [];

  visit(parser.parse(markdown) as Root, (node) => {
    const directive = node as unknown as DirectiveLike;
    if (
      directive.type !== 'containerDirective' &&
      directive.type !== 'leafDirective' &&
      directive.type !== 'textDirective'
    ) {
      return;
    }

    const definition = registry.get(directive.name);
    if (!definition) return;

    const id = directive.attributes?.id;
    if (typeof id !== 'string' || id === '') return;

    if (definition.name === 'quiz') {
      // The island's own `extract` decides what a question is, so the count
      // here and the `total` the quiz records on submission come from one
      // definition rather than two readings of the same body.
      const questions = definition.extract?.(node) as QuizQuestion[] | undefined;
      const points = Array.isArray(questions) ? questions.length : 0;
      if (points > 0) found.push({ kind: 'quiz', id, points });
      return;
    }

    if (definition.name === 'checkpoint') {
      found.push({ kind: 'checkpoint', id, points: 1 });
    }
  });

  return found;
}

/**
 * Whether this book measures the reader at all.
 *
 * The progress dashboard used to render for every book, so a novel was told
 * `0 sections done · 0/0 quiz points · 0 quizzes taken` permanently — three
 * numbers no reader of that book can ever move, because there is nothing in it
 * to score. The shell was reporting an absence as a result.
 *
 * **The question is about the book, not about the reader.** `readBookStats`
 * cannot answer it: its totals come from *stored scores*, so it reports zero
 * both for a novel and for a quiz-heavy book nobody has opened yet — and those
 * two must not be conflated. A book full of quizzes has to show `0/40` on the
 * first day, because there the zero is the reader's position and moving it is
 * the point. So the denominator has to come from the content, which is what
 * this walks.
 *
 * Stops at the first scorable it finds: the answer is a yes or a no, and books
 * that have any usually have one early.
 */
export function hasScorables(book: Book, registry: IslandRegistry): boolean {
  return book.chapters.some((chapter) => chapterScorables(chapter.markdown, registry).length > 0);
}
