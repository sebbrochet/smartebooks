import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import { extractQuiz } from './extract';
import type { QuizQuestion } from '../types';

function parseQuiz(markdown: string): QuizQuestion[] {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(markdown);
  let result: QuizQuestion[] = [];
  visit(tree as Root, (node) => {
    const n = node as unknown as { type: string; name?: string };
    if (n.type === 'containerDirective' && n.name === 'quiz') {
      result = extractQuiz(node);
    }
  });
  return result;
}

describe('extractQuiz', () => {
  it('parses a single-answer question with an explanation', () => {
    const md = [
      ':::quiz{id="t"}',
      '### What is a token?',
      '',
      '- [ ] A sentence',
      '- [x] A sub-word chunk',
      '',
      '> Explanation: Tokens are sub-word units.',
      ':::',
      '',
    ].join('\n');

    const [q] = parseQuiz(md);
    expect(q.prompt).toBe('What is a token?');
    expect(q.options).toHaveLength(2);
    expect(q.options[1]).toEqual({ text: 'A sub-word chunk', correct: true });
    expect(q.multi).toBe(false);
    expect(q.explanation).toBe('Tokens are sub-word units.');
  });

  it('detects multi-select questions', () => {
    const md = [
      ':::quiz{id="t"}',
      '### Pick the true statements',
      '',
      '- [x] Markdown authoring',
      '- [x] Local storage',
      '- [ ] Requires a server',
      ':::',
      '',
    ].join('\n');

    const [q] = parseQuiz(md);
    expect(q.multi).toBe(true);
    expect(q.options.filter((o) => o.correct)).toHaveLength(2);
  });

  it('parses multiple questions in one quiz block', () => {
    const md = [
      ':::quiz{id="t"}',
      '### Q1',
      '',
      '- [x] A',
      '- [ ] B',
      '',
      '### Q2',
      '',
      '- [ ] C',
      '- [x] D',
      ':::',
      '',
    ].join('\n');

    const questions = parseQuiz(md);
    expect(questions).toHaveLength(2);
    expect(questions[0].prompt).toBe('Q1');
    expect(questions[1].prompt).toBe('Q2');
  });
});
