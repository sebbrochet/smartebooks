import type { BlockContent, PhrasingContent, RootContent } from 'mdast';
import type { FlashcardData, QuizQuestion } from '../types';
import { attrText } from './attributes';
import type { AttributeValue } from './attributes';

/**
 * Static, export-safe representations of islands (SPEC001 P1.1).
 *
 * An island is interactive by definition, but the platform promises that a book
 * still reads as a coherent document when the interactivity is stripped — in
 * print, in EPUB, with no JavaScript, and to a search indexer. That is only
 * true if each island can say what it *is* in plain content.
 *
 * These run at compile time, and their output is placed in the `<island>`
 * element's children. `IslandHost` ignores those children and mounts the live
 * component; an exporter does the opposite.
 *
 * Scope note: only text-shaped islands are covered so far. Islands whose
 * printed form is a picture (a chess diagram, an engraved score) need the
 * build-time asset emission described in SPEC001 P1.1, which waits on a real
 * exporter to render against.
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
