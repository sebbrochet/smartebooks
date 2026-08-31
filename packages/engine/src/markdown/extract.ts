import type { FlashcardData, QuizOption, QuizQuestion } from '../types';

/**
 * Recursively extract the visible text of an mdast node.
 */
export function mdastToText(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (!n) return '';
  if (typeof n.value === 'string') return n.value;
  if (Array.isArray(n.children)) return n.children.map(mdastToText).join('');
  return '';
}

/**
 * Return the raw value of the first fenced code block in a directive body, if
 * any. Useful for island extractors that carry text bodies (e.g. PGN, JSON)
 * without needing any domain dependency at parse time.
 *
 * With `consume`, the block is also **removed** from the body. That matters
 * only for an island that renders its own children (SPEC001 P2.10a): its body
 * is prose the reader sees, and the fenced data block is configuration, not
 * content — leaving it in would print a wall of PGN above the game it
 * describes. P3.2 is the principled home for this, where an island would
 * declare `body: 'code+prose'` and the engine would do it; until then an island
 * asks for it here rather than reaching into the tree itself.
 */
export function extractDirectiveCode(
  node: unknown,
  options?: { consume?: boolean },
): string | undefined {
  const parent = node as { children?: unknown[] };
  const children = parent.children ?? [];
  for (const [index, raw] of children.entries()) {
    const child = raw as { type?: string; value?: string };
    if (child.type === 'code' && typeof child.value === 'string') {
      if (options?.consume) children.splice(index, 1);
      return child.value;
    }
  }
  return undefined;
}

/**
 * Extract structured quiz questions from a `:::quiz` container directive node.
 *
 * Convention (see editorial-charter.md §4):
 *   - each `### heading` starts a new question
 *   - the following task list holds the options (`- [x]` marks a correct answer)
 *   - an optional `> blockquote` provides the explanation
 */
export function extractQuiz(node: unknown): QuizQuestion[] {
  const children = (node as { children?: unknown[] }).children ?? [];
  const questions: QuizQuestion[] = [];
  let current: QuizQuestion | null = null;

  for (const rawChild of children) {
    const child = rawChild as {
      type?: string;
      children?: unknown[];
      checked?: boolean | null;
    };

    if (child.type === 'heading') {
      current = {
        prompt: mdastToText(child).trim(),
        options: [],
        explanation: undefined,
        multi: false,
      };
      questions.push(current);
    } else if (child.type === 'list' && current) {
      for (const rawItem of child.children ?? []) {
        const item = rawItem as { checked?: boolean | null };
        const option: QuizOption = {
          text: mdastToText(item).trim(),
          correct: item.checked === true,
        };
        current.options.push(option);
      }
      current.multi = current.options.filter((o) => o.correct).length > 1;
    } else if (child.type === 'blockquote' && current) {
      current.explanation = mdastToText(child)
        .replace(/^\s*Explanation:\s*/i, '')
        .trim();
    }
  }

  return questions;
}

/**
 * Extract a flashcard's front and back from a `:::flashcard` container.
 *
 * Convention (see editorial-charter.md §4):
 *   **Front:** … / **Back:** … (the "Front:"/"Back:" labels are stripped).
 */
export function extractFlashcard(node: unknown): FlashcardData {
  const text = mdastToText(node);
  const backMatch = text.search(/Back\s*:/i);
  let front = text;
  let back = '';
  if (backMatch >= 0) {
    front = text.slice(0, backMatch);
    back = text
      .slice(backMatch)
      .replace(/^Back\s*:/i, '')
      .trim();
  }
  front = front.replace(/^\s*Front\s*:/i, '').trim();
  return { front, back };
}

/**
 * Extract a directive's JSON body. Prefers a fenced code block; falls back to
 * parsing the whole body as JSON. Returns `{}` on error.
 */
export function extractJsonConfig(node: unknown): unknown {
  const children = (node as { children?: unknown[] }).children ?? [];
  for (const raw of children) {
    const child = raw as { type?: string; value?: string };
    if (child.type === 'code' && typeof child.value === 'string') {
      try {
        return JSON.parse(child.value);
      } catch {
        return {};
      }
    }
  }
  try {
    return JSON.parse(mdastToText(node));
  } catch {
    return {};
  }
}
