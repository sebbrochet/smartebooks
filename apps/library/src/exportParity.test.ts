import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import specSource from '../../../packages/engine/src/package/spec.ts?raw';
import {
  exportBookToZip,
  makeBook,
  defaultIslands,
  isAuthorId as engineIsAuthorId,
  isEdition as engineIsEdition,
  isLanguageTag as engineIsLanguageTag,
  type SmartbookDescriptor,
} from '@smart-ebooks/engine';
import { chessIslands } from '@smart-ebooks/islands-chess';
import {
  deriveChapters,
  isAuthorId,
  isLanguageTag,
  isOrderableEdition,
} from '../../../scripts/book-sources.mjs';
import { usedIslands } from '../../../scripts/lint-islands.mjs';

/**
 * The browser exporter (`exportBookToZip`, TypeScript) and the CLI packager
 * (`scripts/*.mjs`) must produce the same descriptor for the same book.
 *
 * They cannot share code: the scripts are plain `.mjs` and cannot import the
 * engine's TypeScript. That duplication is exactly how the two silently drifted
 * once already — the CLI shipped packages with no `chapters` (SPEC003 E2.3) and
 * no `islands.required` (SPEC001 P2.1), which matters most for the private-repo
 * workflow, where the CLI is the *only* path.
 *
 * So the rules are written twice and compared here.
 */

const markdown = {
  './content/02-endgames.md': '# Endgames\n\n::chessboard{id="e"}\n',
  './content/01-openings.md':
    '# Openings\n\n:::quiz{id="q"}\n\n### Q\n\n:::\n\n::audio{id="a" src="https://e.com/a.mp3"}\n',
  // No numeric prefix and no `#` heading: exercises both fallbacks (order 999,
  // title from the slug), which a fixture of tidy files would silently skip.
  './content/appendix.md': 'Loose notes.\n',
};

const files = Object.entries(markdown).map(([path, md]) => ({
  path: path.replace('./', ''),
  markdown: md,
}));

function exportedDescriptor(descriptor: SmartbookDescriptor) {
  const book = makeBook(descriptor, markdown, [...defaultIslands, ...chessIslands()]);
  const entries = unzipSync(exportBookToZip(book));
  return JSON.parse(strFromU8(entries['smartbook.json']));
}

/**
 * Field names on `SmartbookChapterEntry`, read from the source of truth.
 *
 * The same trick `scripts/schema.test.mjs` uses on the descriptor, and for the
 * same reason: a list of fields written out by hand only ever describes what
 * somebody remembered. Reading the interface means the *type* decides what this
 * file has to cover.
 *
 * `?raw` rather than `node:fs`: this file is compiled by the app's tsconfig,
 * which types `vite/client` and not Node.
 */
function chapterEntryFields(): string[] {
  const body = /export interface SmartbookChapterEntry \{([\s\S]*?)\n\}/.exec(specSource);
  expect(body, 'could not find SmartbookChapterEntry in spec.ts').not.toBeNull();
  return [...body![1].matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]);
}

describe('CLI and browser exporters agree', () => {
  const base: SmartbookDescriptor = {
    schemaVersion: 2,
    slug: 'chess',
    title: 'Chess',
    visibility: 'private',
    islands: { packs: { chess: {} } },
  };

  it('derives the same chapters when the descriptor declares none', () => {
    expect(deriveChapters(base, files)).toEqual(exportedDescriptor(base).chapters);
  });

  it('derives the same chapters when the descriptor declares them', () => {
    const descriptor: SmartbookDescriptor = {
      ...base,
      chapters: [
        { file: '02-endgames.md', order: 1, title: 'Endgames first' },
        { file: '01-openings.md', order: 2 },
      ],
    };
    expect(deriveChapters(descriptor, files)).toEqual(exportedDescriptor(descriptor).chapters);
  });

  /**
   * The packaged descriptor is what a reader actually receives, and the CLI
   * dropped `part` from every entry while the browser kept it — so a book
   * declaring parts arrived flat, and only for the path real books take.
   *
   * The other cases here compare two *derivations* of the same thing, which
   * agreed because both were wrong in the same way about nothing. This one
   * names the field, because "the two exporters agree" is only worth something
   * if the fields that carry meaning are among the ones compared.
   */
  it('carries a chapter’s part through both exporters', () => {
    const descriptor: SmartbookDescriptor = {
      ...base,
      parts: [{ id: 'basics', title: 'Part I — Basics' }],
      chapters: [
        { file: '01-openings.md', order: 1, part: 'basics' },
        { file: '02-endgames.md', order: 2 },
      ],
    };

    const fromCli = deriveChapters(descriptor, files);
    expect(fromCli).toEqual(exportedDescriptor(descriptor).chapters);
    expect(fromCli[0].part).toBe('basics');
    expect(fromCli[1]).not.toHaveProperty('part');
  });

  /**
   * And the generalisation, because naming `part` fixed the instance and left
   * the mechanism (SPEC008 decision 18).
   *
   * `toEqual` between two derivations is worth nothing for a field neither
   * fixture sets: both omit it, both agree, the test is green and the packaged
   * book is missing something. That is not hypothetical — it is exactly how
   * `part` was lost for eleven days, and the test above was written afterwards
   * by someone who knew which field to name. Nobody will know the next one.
   *
   * So the fixture sets **every** field the interface declares and the
   * assertion reads that list from the interface: add one to
   * `SmartbookChapterEntry` and this fails until both exporters carry it.
   */
  it('carries every field the chapter type declares, through both exporters', () => {
    const declared = chapterEntryFields();
    // A regex over source is a blunt instrument; if it ever matches nothing,
    // the loop below would pass by asserting nothing at all.
    expect(declared, 'fields read from spec.ts').toContain('file');
    expect(declared.length).toBeGreaterThanOrEqual(4);

    const descriptor: SmartbookDescriptor = {
      ...base,
      parts: [{ id: 'basics', title: 'Part I — Basics' }],
      chapters: [{ file: '01-openings.md', order: 1, title: 'Openings', part: 'basics' }],
    };

    const keysOf = (entries: object[]) => [...new Set(entries.flatMap((e) => Object.keys(e)))];
    const fromCli = keysOf(deriveChapters(descriptor, files));
    const fromBrowser = keysOf(exportedDescriptor(descriptor).chapters);

    for (const field of declared) {
      expect(fromCli, `the CLI packager drops "${field}"`).toContain(field);
      expect(fromBrowser, `the browser exporter drops "${field}"`).toContain(field);
    }
  });

  it('derives the same required islands, resolving aliases the same way', () => {
    const required = exportedDescriptor(base).islands.required;
    expect(usedIslands(base, files)).toEqual(required);
    // ::chessboard is an alias; both sides must record the canonical name.
    expect(required).toContain('chess-board');
    expect(required).toEqual(['audio', 'chess-board', 'quiz']);
  });

  it('keeps a declared requirement neither side can recognise', () => {
    const descriptor: SmartbookDescriptor = {
      ...base,
      islands: { packs: { chess: {} }, required: ['score'] },
    };
    expect(usedIslands(descriptor, files)).toEqual(exportedDescriptor(descriptor).islands.required);
    expect(usedIslands(descriptor, files)).toContain('score');
  });
});

/**
 * The identity rules are duplicated for the same reason the chapter derivation
 * is: `scripts/*.mjs` cannot load the engine's TypeScript, and the linter has
 * to reject a bad `authorId` or `edition` before a book is ever packaged.
 *
 * Two copies of a regular expression is exactly the arrangement that let
 * `part` go missing (`87faf05`), so they are compared here on one shared table
 * rather than left to agree by inspection.
 */
describe('the linter and the reader agree on identity', () => {
  const authorIds = [
    'example.com',
    'books.example.co.uk',
    'a-b.c-d.org',
    'guide',
    'Example.com',
    'example..com',
    '-example.com',
    '.com',
    '',
  ];

  it.each(authorIds)('reads %s the same way', (value) => {
    expect(isAuthorId(value)).toBe(engineIsAuthorId(value));
  });

  const editions = [
    '2026-09-04',
    '2024-02-29',
    '2026-02-31',
    '2025-02-29',
    '2026-13-01',
    '1.2.0',
    '10.20.30',
    '1.2',
    'v1.2.0',
    '1.2.0-beta.1',
    'second edition',
    '',
  ];

  it.each(editions)('orders, or refuses to order, %s the same way', (value) => {
    expect(isOrderableEdition(value)).toBe(engineIsEdition(value));
  });

  const languages = [
    'fr',
    'en',
    'en-GB',
    'pt-BR',
    'zh-Hant-TW',
    'fra',
    'f',
    'french',
    'en_GB',
    'en-',
    '-en',
    'en--GB',
    'en GB',
    '<script>',
    '',
  ];

  it.each(languages)('accepts, or refuses, the language %s the same way', (value) => {
    expect(isLanguageTag(value)).toBe(engineIsLanguageTag(value));
  });
});
