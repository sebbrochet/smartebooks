/**
 * Run with `npm run test:scripts`.
 *
 * The music islands fail quietly by design, so every check here is about a
 * failure a reader would meet as silence or as a sentence that has stopped
 * being clickable — none of which shows up in a diff.
 *
 * These spawn real processes because `BOOKS_DIR` is resolved when
 * `book-sources.mjs` is first imported, so it cannot be re-pointed in-process.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './book-sources.mjs';

let workspace;
let booksDir;

const DESCRIPTOR = {
  schemaVersion: 2,
  authorId: 'example.com',
  slug: 'tunes',
  title: 'Tunes',
  visibility: 'private',
  islands: { packs: { music: {} } },
};

const TUNE = 'X:1\nL:1/4\nK:C\nC C G G | A A G2 |';

/** Writes a one-chapter book and returns the linter's result. */
function lint(markdown, { assets } = {}) {
  const folder = join(booksDir, DESCRIPTOR.slug);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(join(folder, 'content'), { recursive: true });

  const descriptor = { ...DESCRIPTOR };
  if (assets) {
    mkdirSync(join(folder, 'assets'), { recursive: true });
    descriptor.assets = Object.keys(assets);
    for (const [path, content] of Object.entries(assets)) {
      writeFileSync(join(folder, path), content);
    }
  }

  writeFileSync(join(folder, 'smartbook.json'), JSON.stringify(descriptor, null, 2));
  writeFileSync(join(folder, 'content', '01-chapter.md'), markdown);

  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'lint-content.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, SMART_EBOOKS_BOOKS_DIR: booksDir },
  });

  return { code: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

describe('lint-music', () => {
  before(() => {
    workspace = mkdtempSync(join(tmpdir(), 'smart-ebooks-music-'));
    booksDir = join(workspace, 'books');
    mkdirSync(booksDir, { recursive: true });
  });

  after(() => rmSync(workspace, { recursive: true, force: true }));

  const piece = (abc) =>
    `# One\n\n:::music-piece{caption="A tune"}\n\n\`\`\`abc\n${abc}\n\`\`\`\n\n:::\n`;
  const figure = (abc) =>
    `# One\n\n:::music-figure{caption="A tune"}\n\n\`\`\`abc\n${abc}\n\`\`\`\n\n:::\n`;

  const CHORD = 'X:1\nL:1/4\nK:C\n[CEG] D|';
  const TIE = 'X:1\nL:1/4\nK:C\nC2-C2|';
  const TRIPLET = 'X:1\nL:1/4\nK:C\n(3CDE|';
  const VOICES = 'X:1\nL:1/4\nK:C\nV:1\nC D|\nV:2\nE F|';

  test('a chord in a piece is refused: it would sound as one note', () => {
    const { code, output } = lint(piece(CHORD));
    assert.equal(code, 1);
    assert.match(output, /music-unplayable.*chord/);
  });

  test('a tie in a piece is refused: it would sound twice', () => {
    const { code, output } = lint(piece(TIE));
    assert.equal(code, 1);
    assert.match(output, /music-unplayable.*tied/);
  });

  test('a tuplet in a piece is refused: its notes would get equal time', () => {
    const { code, output } = lint(piece(TRIPLET));
    assert.equal(code, 1);
    assert.match(output, /music-unplayable.*tuplet/);
  });

  test('a second voice in a piece is refused: the voices would follow each other', () => {
    const { code, output } = lint(piece(VOICES));
    assert.equal(code, 1);
    assert.match(output, /music-unplayable.*voice/);
  });

  test('a figure may contain all of them, because a figure only draws', () => {
    // The whole point of the rule: engraving goes to abcjs and never through
    // notesOf, so a figure renders these correctly and must stay permissive.
    for (const abc of [CHORD, TIE, TRIPLET, VOICES]) {
      const { code, output } = lint(figure(abc));
      assert.equal(code, 0, output);
    }
  });

  test('a melody written over several lines is not polyphony', () => {
    // The first version of this rule counted staves across the whole tune and
    // called the bundled book's three-line melody a three-voice piece.
    const { code, output } = lint(piece('X:1\nL:1/4\nK:C\nC D E F|\nG A B c|\nc B A G|'));
    assert.equal(code, 0, output);
  });

  test('a slur is not a tie, and a rest is not a chord', () => {
    const { code, output } = lint(piece('X:1\nL:1/4\nK:C\n(CD) z E|'));
    assert.equal(code, 0, output);
  });

  test('a correct piece passes', () => {
    const { code } = lint(
      `# One\n\n:::music-piece{caption="A tune"}\n\n\`\`\`abc\n${TUNE}\n\`\`\`\n\nIt climbs to :note[A].\n\n:::\n`,
    );
    assert.equal(code, 0);
  });

  test('a note the tune does not contain is an error', () => {
    const { code, output } = lint(
      `# One\n\n:::music-piece{caption="A tune"}\n\n\`\`\`abc\n${TUNE}\n\`\`\`\n\nIt ends on :note[B].\n\n:::\n`,
    );
    assert.equal(code, 1);
    assert.match(output, /music-note-unresolved/);
  });

  test('nth beyond the number of that note is an error, and says how many there are', () => {
    const { code, output } = lint(
      `# One\n\n:::music-piece{caption="A tune"}\n\n\`\`\`abc\n${TUNE}\n\`\`\`\n\nThe :note[G]{nth=9}.\n\n:::\n`,
    );
    assert.equal(code, 1);
    assert.match(output, /music-note-unresolved.*there are only 3/);
  });

  test('a container with no tune at all is an error', () => {
    const { code, output } = lint(
      `# One\n\n:::music-figure{caption="Nothing"}\n\nJust prose.\n\n:::\n`,
    );
    assert.equal(code, 1);
    assert.match(output, /music-no-tune/);
  });

  test('abc that parses to no notes is an error, not an empty stave', () => {
    const { code, output } = lint(
      `# One\n\n:::music-figure{caption="Empty"}\n\n\`\`\`abc\nX:1\nK:C\n\`\`\`\n\n:::\n`,
    );
    assert.equal(code, 1);
    assert.match(output, /music-silent-tune/);
  });

  test('compressed MusicXML is refused by name, because it is a ZIP', () => {
    const { code, output } = lint(`# One\n\n:::music-figure{src="assets/tune.mxl"}\n\n:::\n`);
    assert.equal(code, 1);
    assert.match(output, /music-source-format.*ZIP/);
  });

  test('a file and an inline tune together is an error, because the file wins', () => {
    const { code, output } = lint(
      `# One\n\n:::music-piece{src="assets/tune.abc"}\n\n\`\`\`abc\n${TUNE}\n\`\`\`\n\n:::\n`,
      { assets: { 'assets/tune.abc': TUNE } },
    );
    assert.equal(code, 1);
    assert.match(output, /music-two-tunes/);
  });

  test('a note outside any piece is an error, because it renders as plain text', () => {
    const { code, output } = lint(`# One\n\nA loose :note[A] in prose.\n`);
    assert.equal(code, 1);
    assert.match(output, /music-note-loose/);
  });

  test('a note is resolved against the tune in the file, not the one inline', () => {
    const { code, output } = lint(
      `# One\n\n:::music-piece{src="assets/tune.abc"}\n\nIt reaches :note[E].\n\n:::\n`,
      { assets: { 'assets/tune.abc': TUNE } },
    );
    assert.equal(code, 1);
    assert.match(output, /music-note-unresolved/, 'E is in no tune here, so the file was read');
  });
});
