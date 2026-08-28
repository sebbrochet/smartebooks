/**
 * Run with `npm run test:scripts` (Node's built-in runner — no DOM needed).
 *
 * A linter that quietly finds nothing is worse than no linter, so these tests
 * are mostly about proving it *rejects* things.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkDirectives } from './lint-islands.mjs';

const book = (islands) => ({ slug: 'demo', islands });
const file = (markdown) => [{ path: 'content/01.md', markdown }];
const rules = (problems) => problems.map((p) => p.rule);

describe('checkDirectives', () => {
  test('accepts built-in islands with no pack declared', () => {
    assert.deepEqual(checkDirectives(book(), file(':::quiz{id="q1"}\n\n### Q\n\n:::')), []);
  });

  test('accepts a pack island when the book declares the pack', () => {
    const descriptor = book({ packs: { chess: {} } });
    assert.deepEqual(checkDirectives(descriptor, file('::chessanalysis{fen="8/8"}')), []);
  });

  // The failure this prevents: a grey "Unknown interactive block" in a
  // published book, found by a reader rather than by the build.
  test('rejects a pack island the book did not declare, and names the pack', () => {
    const problems = checkDirectives(book(), file('::chessanalysis{fen="8/8"}'));
    assert.deepEqual(rules(problems), ['directive-unknown']);
    assert.match(problems[0].message, /needs the "chess" island pack/);
  });

  test('rejects a directive no pack provides', () => {
    assert.deepEqual(rules(checkDirectives(book(), file(':::nonsense\n\nhi\n\n:::'))), [
      'directive-unknown',
    ]);
  });

  test('rejects an unknown pack in the descriptor', () => {
    const problems = checkDirectives(book({ packs: { nope: {} } }), file('hello'));
    assert.deepEqual(rules(problems), ['pack-unknown']);
  });

  // Two islands sharing an id silently share the reader's saved progress.
  test('rejects a duplicate id and points at the first use', () => {
    const markdown = ':::quiz{id="same"}\n\n### A\n\n:::\n\n:::flashcard{id="same"}\n\nB\n\n:::';
    const problems = checkDirectives(book(), file(markdown));
    assert.deepEqual(rules(problems), ['id-duplicate']);
    assert.match(problems[0].message, /already used at content\/01\.md:1/);
  });

  test('catches a duplicate id across two files of one book', () => {
    const across = [
      { path: 'content/01.md', markdown: ':::quiz{id="q"}\n\n### A\n\n:::' },
      { path: 'content/02.md', markdown: ':::quiz{id="q"}\n\n### B\n\n:::' },
    ];
    assert.deepEqual(rules(checkDirectives(book(), across)), ['id-duplicate']);
  });

  // Why the real parser is used instead of a regex.
  test('ignores directive-looking text inside fenced code', () => {
    const markdown = '```\n:::quiz{id="not-real"}\n```\n\n:::quiz{id="real"}\n\n### Q\n\n:::';
    assert.deepEqual(checkDirectives(book(), file(markdown)), []);
  });

  test('reports the line a problem is on', () => {
    const markdown = '# Title\n\nSome prose.\n\n:::nonsense\n\nhi\n\n:::';
    assert.match(checkDirectives(book(), file(markdown))[0].message, /content\/01\.md:5/);
  });
});
