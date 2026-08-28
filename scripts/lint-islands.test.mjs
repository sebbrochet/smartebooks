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
    assert.deepEqual(checkDirectives(descriptor, file('::chess-analysis{fen="8/8"}')), []);
  });

  // The failure this prevents: a grey "Unknown interactive block" in a
  // published book, found by a reader rather than by the build.
  test('rejects a pack island the book did not declare, and names the pack', () => {
    const problems = checkDirectives(book(), file('::chess-analysis{fen="8/8"}'));
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

  // A rename must not break already-published books, so an old spelling still
  // resolves — but it is reported so content migrates (SPEC001 P1.4).
  test('warns on a renamed island rather than rejecting it', () => {
    const problems = checkDirectives(book(), file(':::matchingpairs{id="m"}\n\nhi\n\n:::'));
    assert.deepEqual(rules(problems), ['directive-alias']);
    assert.equal(problems[0].severity, 'warning');
    assert.match(problems[0].message, /old name for ":::matching-pairs"/);
  });

  test('accepts the canonical name with no warning', () => {
    assert.deepEqual(checkDirectives(book(), file(':::matching-pairs{id="m"}\n\nhi\n\n:::')), []);
  });

  // The alias belongs to a pack island, so a book without the pack still gets
  // a hard error — and it should still say which pack, despite the old name.
  test('does not let an alias smuggle in an undeclared pack', () => {
    const problems = checkDirectives(book(), file('::chessboard{id="c"}'));
    assert.deepEqual(rules(problems), ['directive-unknown']);
    assert.equal(problems[0].severity, 'error');
    assert.match(problems[0].message, /needs the "chess" island pack/);
    assert.match(problems[0].message, /now ":::chess-board"/);
  });

  test('warns on a pack alias when the book declares the pack', () => {
    const descriptor = book({ packs: { chess: {} } });
    const problems = checkDirectives(descriptor, file('::chessboard{id="c"}'));
    assert.deepEqual(rules(problems), ['directive-alias']);
  });

  test('marks real problems as errors', () => {
    const problems = checkDirectives(book(), file(':::nonsense\n\nhi\n\n:::'));
    assert.equal(problems[0].severity, 'error');
  });
});
