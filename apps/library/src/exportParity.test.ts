import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  exportBookToZip,
  makeBook,
  defaultIslands,
  isAuthorId as engineIsAuthorId,
  isEdition as engineIsEdition,
  type SmartbookDescriptor,
} from '@smart-ebooks/engine';
import { chessIslands } from '@smart-ebooks/islands-chess';
import { deriveChapters, isAuthorId, isOrderableEdition } from '../../../scripts/book-sources.mjs';
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
});
