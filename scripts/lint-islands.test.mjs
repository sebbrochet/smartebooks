/**
 * Run with `npm run test:scripts` (Node's built-in runner — no DOM needed).
 *
 * A linter that quietly finds nothing is worse than no linter, so these tests
 * are mostly about proving it *rejects* things.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkDirectives } from './lint-islands.mjs';
import { checkDeclaredAssets, checkParts } from './book-sources.mjs';

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

  // The two forms are not interchangeable: the engine keeps a text directive's
  // label and drops a block's body, so writing one as the other renders
  // something the author did not intend and no error anywhere says so.
  test('accepts an inline island written inside a sentence', () => {
    assert.deepEqual(
      checkDirectives(book(), file('A :term[palimpsest]{definition="Reused."} page.')),
      [],
    );
  });

  test('rejects an inline island written as a block', () => {
    const problems = checkDirectives(book(), file('::term{definition="Reused."}'));
    assert.deepEqual(rules(problems), ['directive-form']);
    assert.match(problems[0].message, /inside a sentence/);
  });

  test('rejects a block island written inside a sentence', () => {
    const problems = checkDirectives(book(), file('A :checkpoint[done]{id="c"} page.'));
    assert.deepEqual(rules(problems), ['directive-form']);
    assert.match(problems[0].message, /block directive/);
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

  // An island that saves something and has no id writes to a key like `quiz:`,
  // and so does every other id-less quiz in the book, so two readers' answers
  // become one. Nothing at runtime says so.
  test('rejects a stateful island with no id', () => {
    const problems = checkDirectives(book(), file(':::quiz\n\n### A\n\n:::'));
    assert.deepEqual(rules(problems), ['id-missing']);
    assert.match(problems[0].message, /needs an id/);
  });

  test('says nothing about an island that saves nothing', () => {
    assert.deepEqual(checkDirectives(book(), file('A :term[palimpsest] page.')), []);
    assert.deepEqual(
      checkDirectives(book({ packs: { chess: {} } }), file('::chess-analysis{fen="8/8"}')),
      [],
    );
  });

  // Statefulness is not always a property of the island alone: inside a
  // `chess-game` the container owns one position for every board in it, so
  // demanding an id from each board would be asking for a key nothing writes.
  test('does not demand an id from a board whose container owns the state', () => {
    const markdown = [
      ':::chess-game{id="g"}',
      '',
      '```pgn',
      '1. e4 e5',
      '```',
      '',
      '::chess-board',
      '',
      ':::',
    ].join('\n');
    assert.deepEqual(checkDirectives(book({ packs: { chess: {} } }), file(markdown)), []);
  });

  test('still demands one from the same board standing on its own', () => {
    const markdown = ':::chess-board\n\n```pgn\n1. e4 e5\n```\n\n:::';
    const problems = checkDirectives(book({ packs: { chess: {} } }), file(markdown));
    assert.deepEqual(rules(problems), ['id-missing']);
  });

  test('and from the container itself', () => {
    const markdown = ':::chess-game\n\n```pgn\n1. e4 e5\n```\n\n::chess-board\n\n:::';
    const problems = checkDirectives(book({ packs: { chess: {} } }), file(markdown));
    assert.deepEqual(rules(problems), ['id-missing']);
  });

  // Every other attribute rule is about a bad *value*. These are about a good
  // value in the wrong place, which the forgiving runtime cannot report: the
  // attribute is on the island's schema, it lints clean, and nothing reads it.
  const chess = book({ packs: { chess: {} } });

  test('rejects an attribute the surrounding container owns', () => {
    const markdown = [
      ':::chess-game{id="g"}',
      '',
      '```pgn',
      '1. e4 e5',
      '```',
      '',
      '::chess-board{moves=on}',
      '',
      ':::',
    ].join('\n');
    const problems = checkDirectives(chess, file(markdown));
    assert.deepEqual(rules(problems), ['attribute-ignored']);
    assert.match(problems[0].message, /"moves" does nothing .* inside a ":::chess-game"/);
  });

  test('rejects an attribute that needs a container it is not in', () => {
    const markdown = ':::chess-board{id="b" at="1. e4"}\n\n```pgn\n1. e4 e5\n```\n\n:::';
    const problems = checkDirectives(chess, file(markdown));
    assert.deepEqual(rules(problems), ['attribute-ignored']);
    assert.match(problems[0].message, /outside a ":::chess-game"/);
  });

  test('accepts each of them where it is read', () => {
    const inside = [
      ':::chess-game{id="g"}',
      '',
      '```pgn',
      '1. e4 e5',
      '```',
      '',
      '::chess-board{at="1. e4"}',
      '',
      '::chess-moves',
      '',
      ':::',
    ].join('\n');
    assert.deepEqual(checkDirectives(chess, file(inside)), []);

    const outside = ':::chess-board{id="b" moves=on}\n\n```pgn\n1. e4 e5\n```\n\n:::';
    assert.deepEqual(checkDirectives(chess, file(outside)), []);
  });

  // Saying nothing when the attribute was not written is the difference between
  // a rule and a nag.
  test('says nothing about a context-bound attribute nobody used', () => {
    const markdown = ':::chess-board{id="b"}\n\n```pgn\n1. e4 e5\n```\n\n:::';
    assert.deepEqual(checkDirectives(chess, file(markdown)), []);
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
  //
  // These fixtures carry an `id` because the island under test is a stateful
  // one, and omitting it is now its own error — which would drown the rule
  // each of these is actually about.
  test('rejects a value outside an enum', () => {
    const descriptor = book({ packs: { chess: {} } });
    const problems = checkDirectives(descriptor, file('::chess-board{id="b" theme="hot-pink"}'));
    assert.deepEqual(rules(problems), ['attribute-invalid']);
    assert.match(problems[0].message, /must be one of brown, blue, green, grey/);
  });

  test('accepts every value the enum allows', () => {
    const descriptor = book({ packs: { chess: {} } });
    for (const theme of ['brown', 'blue', 'green', 'grey']) {
      assert.deepEqual(
        checkDirectives(descriptor, file(`::chess-board{id="b" theme="${theme}"}`)),
        [],
      );
    }
  });

  test('rejects a missing required attribute', () => {
    const problems = checkDirectives(book(), file('::video{id="v" title="No source"}'));
    assert.deepEqual(rules(problems), ['attribute-invalid']);
    assert.match(problems[0].message, /"src" is required/);
  });

  test('accepts a bare boolean flag', () => {
    const descriptor = book({ packs: { chess: {} } });
    assert.deepEqual(checkDirectives(descriptor, file('::chess-board{id="b" analysis}')), []);
  });

  test('rejects a boolean it cannot read', () => {
    const descriptor = book({ packs: { chess: {} } });
    const problems = checkDirectives(descriptor, file('::chess-board{id="b" analysis="maybe"}'));
    assert.deepEqual(rules(problems), ['attribute-invalid']);
  });

  test('says nothing about attributes an island never declared', () => {
    assert.deepEqual(checkDirectives(book(), file('::video{id="v" src="a.mp4" data-x="y"}')), []);
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

/**
 * Parts are referenced by id rather than written as a label on each chapter,
 * and this is why: a label grouped by string equality means one typo silently
 * splits a part in two, with nothing able to tell that from an author who meant
 * it. Every rule below is a mistake that spelling would have hidden.
 */
describe('checkParts', () => {
  const book = {
    parts: [
      { id: 'one', title: 'Part I' },
      { id: 'two', title: 'Part II' },
    ],
    chapters: [
      { file: '01.md', part: 'one' },
      { file: '02.md', part: 'two' },
    ],
  };

  test('accepts a book whose chapters name parts it declares', () => {
    assert.deepEqual(checkParts(book), []);
  });

  test('says nothing about a book with no parts at all', () => {
    assert.deepEqual(checkParts({ chapters: [{ file: '01.md' }] }), []);
  });

  test('rejects a chapter naming a part that does not exist', () => {
    const problems = checkParts({ ...book, chapters: [{ file: '01.md', part: 'onee' }] });
    assert.equal(problems[0].rule, 'part-unknown');
    assert.match(problems[0].message, /"01\.md" names part "onee"/);
  });

  test('rejects two parts sharing an id, once', () => {
    const parts = [
      { id: 'one', title: 'Part I' },
      { id: 'one', title: 'Also Part I' },
    ];
    const problems = checkParts({ parts, chapters: [{ file: '01.md', part: 'one' }] });
    assert.deepEqual(rules(problems), ['part-duplicate']);
  });

  test('rejects a part missing an id or a title', () => {
    const problems = checkParts({ parts: [{ title: 'Nameless' }], chapters: [] });
    assert.deepEqual(rules(problems), ['part-invalid']);
  });

  // A warning, not an error: it is dead weight in the descriptor, not a broken
  // page, and it must not stop a build or the content checks that follow.
  test('warns about a part no chapter claims', () => {
    const problems = checkParts({ ...book, chapters: [{ file: '01.md', part: 'one' }] });
    assert.deepEqual(rules(problems), ['part-empty']);
    assert.equal(problems[0].severity, 'warning');
    assert.match(problems[0].message, /"two" has no chapters/);
  });
});
