/**
 * Run with `npm run test:scripts` (Node's built-in runner — no DOM needed).
 *
 * A linter that quietly finds nothing is worse than no linter, so these tests
 * are mostly about proving it *rejects* things.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkDirectives } from './lint-islands.mjs';
import { checkDeclaredAssets } from './book-sources.mjs';

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
    // Location is structured, not embedded in the message, so an editor's
    // problem matcher and an agent can both use it.
    const [problem] = checkDirectives(book(), file(markdown));
    assert.equal(problem.file, 'content/01.md');
    assert.equal(problem.line, 5);
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

  // The runtime falls back to a default so a reader never loses a page; the
  // author is told here instead (SPEC001 P1.2).
  test('rejects a value outside an enum', () => {
    const descriptor = book({ packs: { chess: {} } });
    const problems = checkDirectives(descriptor, file('::chess-board{theme="hot-pink"}'));
    assert.deepEqual(rules(problems), ['attribute-invalid']);
    assert.match(problems[0].message, /must be one of brown, blue, green, grey/);
  });

  test('accepts every value the enum allows', () => {
    const descriptor = book({ packs: { chess: {} } });
    for (const theme of ['brown', 'blue', 'green', 'grey']) {
      assert.deepEqual(checkDirectives(descriptor, file(`::chess-board{theme="${theme}"}`)), []);
    }
  });

  test('rejects a missing required attribute', () => {
    const problems = checkDirectives(book(), file('::video{title="No source"}'));
    assert.deepEqual(rules(problems), ['attribute-invalid']);
    assert.match(problems[0].message, /"src" is required/);
  });

  test('accepts a bare boolean flag', () => {
    const descriptor = book({ packs: { chess: {} } });
    assert.deepEqual(checkDirectives(descriptor, file('::chess-board{analysis}')), []);
  });

  test('rejects a boolean it cannot read', () => {
    const descriptor = book({ packs: { chess: {} } });
    const problems = checkDirectives(descriptor, file('::chess-board{analysis="maybe"}'));
    assert.deepEqual(rules(problems), ['attribute-invalid']);
  });

  test('says nothing about attributes an island never declared', () => {
    assert.deepEqual(checkDirectives(book(), file('::video{src="a.mp4" data-x="y"}')), []);
  });
});

/**
 * A packaged asset that isn't packaged fails silently at runtime — the resolver
 * returns nothing and the reader gets an empty player or a broken image. The
 * author is the only one who can still fix it (SPEC001 P2.3 follow-up).
 */
describe('packaged assets', () => {
  const withAssets = (markdown, assets) => checkDirectives(book(), file(markdown), 'demo', assets);

  test('accepts an asset the book ships', () => {
    const problems = withAssets('::audio{id="a" src="assets/narration.wav"}', [
      'assets/narration.wav',
    ]);
    assert.deepEqual(problems, []);
  });

  test('rejects an asset the book does not ship', () => {
    const problems = withAssets('::audio{id="a" src="assets/naration.wav"}', [
      'assets/narration.wav',
    ]);
    assert.deepEqual(rules(problems), ['asset-missing']);
    assert.match(problems[0].message, /src="assets\/naration\.wav" does not exist/);
  });

  test('rejects a missing image, which resolves the same way', () => {
    const problems = withAssets('![A diagram](assets/gone.png)', ['assets/cover.svg']);
    assert.deepEqual(rules(problems), ['asset-missing']);
    assert.match(problems[0].message, /image "assets\/gone\.png"/);
    assert.equal(problems[0].file, 'content/01.md');
    assert.equal(problems[0].line, 1);
  });

  test('leaves external URLs alone', () => {
    const markdown = '::video{id="v" src="https://example.com/a.mp4"}\n\n![x](https://e.com/i.png)';
    assert.deepEqual(withAssets(markdown, []), []);
  });

  // Callers that cannot supply the asset list must get silence, not a report
  // that every asset in the book is missing.
  test('skips the check when the asset list is unknown', () => {
    assert.deepEqual(checkDirectives(book(), file('::audio{id="a" src="assets/x.wav"}')), []);
  });
});

describe('checkDeclaredAssets', () => {
  test('accepts a descriptor whose references all exist', () => {
    const descriptor = { cover: 'assets/cover.svg', assets: ['assets/cover.svg'] };
    assert.deepEqual(checkDeclaredAssets(descriptor, ['assets/cover.svg']), []);
  });

  test('rejects a cover that does not exist', () => {
    const problems = checkDeclaredAssets({ cover: 'assets/cover.png' }, ['assets/cover.svg']);
    assert.deepEqual(rules(problems), ['asset-missing']);
    assert.match(problems[0].message, /cover "assets\/cover\.png"/);
  });

  test('rejects a declared asset that does not exist', () => {
    const problems = checkDeclaredAssets({ assets: ['assets/gone.wav'] }, []);
    assert.deepEqual(rules(problems), ['asset-missing']);
  });

  test('leaves an external cover URL alone', () => {
    assert.deepEqual(checkDeclaredAssets({ cover: 'https://example.com/c.png' }, []), []);
  });
});
