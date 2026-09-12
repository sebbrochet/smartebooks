import type { BlockContent, PhrasingContent, RootContent } from 'mdast';
import type { FlashcardData, QuizQuestion } from '../types';
import { attrText } from './attributes';
import type { AttributeValue } from './attributes';

/**
 * Static, plain-content representations of islands (SPEC001 P1.1).
 *
 * An island is interactive by definition; this is what it *says it is* when the
 * interactivity is stripped away.
 *
 * **Nothing consumes these yet, and the docblock here used to claim otherwise**
 * — "print, EPUB, no-JS, search indexing". Checked 2026-09-12: print renders
 * the live DOM through CSS, no exporter exists, the reader is a client-rendered
 * SPA so there is no no-JS page at all, and search indexes raw Markdown via
 * `toPlainText` without ever asking for a fallback. `IslandHost` ignores these
 * children on purpose. EPUB and PDF are now a declared non-goal (SPEC003 QD5).
 *
 * They are kept for the reason that survived: an island that cannot say what it
 * is in plain words is usually one that has not been thought through, and that
 * test shaped `:choice` and `:::if` more than any exporter would have. The
 * consumer that would make it real is **search**, which today cannot see inside
 * a fenced block at all.
 *
 * These run at compile time, and their output is placed in the `<island>`
 * element's children.
 *
 * Scope note: only text-shaped islands are covered. Islands whose static form
 * is a picture (a chess diagram, an engraved score) would need build-time asset
 * emission, and nothing is waiting for it.
 */

const text = (value: string): PhrasingContent => ({ type: 'text', value });

const paragraph = (children: PhrasingContent[]): BlockContent => ({
  type: 'paragraph',
  children,
});

const strong = (value: string): PhrasingContent => ({
  type: 'strong',
  children: [text(value)],
});

const emphasis = (value: string): PhrasingContent => ({
  type: 'emphasis',
  children: [text(value)],
});

const heading = (depth: 3 | 4, value: string): BlockContent => ({
  type: 'heading',
  depth,
  children: [text(value)],
});

const bulletList = (items: PhrasingContent[][]): BlockContent => ({
  type: 'list',
  ordered: false,
  spread: false,
  children: items.map((children) => ({
    type: 'listItem',
    spread: false,
    children: [paragraph(children)],
  })),
});

/**
 * A quiz prints as its questions plus an answer key — the form a printed
 * workbook uses. The correct answers live in the `- [x]` markers rather than in
 * the prose, so this is derived from the parsed data, not from the body.
 */
export function quizFallback(_node: unknown, data: unknown): RootContent[] {
  const questions = Array.isArray(data) ? (data as QuizQuestion[]) : [];
  if (questions.length === 0) return [];

  const out: RootContent[] = [];
  for (const [index, question] of questions.entries()) {
    out.push(heading(4, `${index + 1}. ${question.prompt}`));
    out.push(
      bulletList(
        question.options.map((option) => [
          text(option.text),
          ...(option.correct ? [text(' '), strong('(correct)')] : []),
        ]),
      ),
    );
    if (question.explanation) {
      out.push(paragraph([emphasis(question.explanation)]));
    }
  }
  return out;
}

/** A flashcard prints as the pair it holds: term — definition. */
export function flashcardFallback(_node: unknown, data: unknown): RootContent[] {
  const card = data as FlashcardData | undefined;
  if (!card?.front) return [];
  return [paragraph([strong(card.front), text(' — '), text(card.back ?? '')])];
}

/**
 * A checkpoint is a place to stop, which is meaningful on paper too — it prints
 * as its own label rather than vanishing.
 */
export function checkpointFallback(
  _node: unknown,
  _data: unknown,
  ctx: { attributes: Record<string, AttributeValue> },
): RootContent[] {
  const label = attrText(ctx.attributes.label, 'Mark this section as complete');
  return [paragraph([emphasis(`Checkpoint: ${label}`)])];
}
