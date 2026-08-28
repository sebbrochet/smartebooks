import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  exportBookToZip,
  makeBook,
  defaultIslands,
  type SmartbookDescriptor,
} from '@smart-ebooks/engine';
import { chessIslands } from '@smart-ebooks/islands-chess';
import { deriveChapters } from '../../../scripts/book-sources.mjs';
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
