import { describe, it, expect } from 'vitest';
import { mainline, moveLabel, pgnToTree } from '@smart-ebooks/islands-chess';

/**
 * The bundled chess book ships an annotated PGN **file**, which is the form
 * real chess material arrives in (SPEC008 G3.2).
 *
 * A PGN that stops replaying halfway fails silently — the reader simply gets a
 * shorter game, with no error anywhere — so the file is checked rather than
 * trusted. It is loaded exactly as the app loads it, through the same `?raw`
 * glob, so a change to how assets are bundled fails here too.
 */
const files = import.meta.glob('../../../books/chess/assets/*.pgn', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('the packaged game', () => {
  const pgn = Object.values(files)[0];
  const tree = pgnToTree(pgn ?? '');
  const line = mainline(tree);

  it('is bundled as text the reader can actually be given', () => {
    expect(Object.keys(files)).toHaveLength(1);
    expect(pgn).toContain('[White "Anderssen, Adolf"]');
  });

  it('replays to the end', () => {
    expect(line).toHaveLength(45);
    expect(moveLabel(line[line.length - 1])).toBe('23. Be7#');
  });

  it('carries the commentary that makes it worth reading', () => {
    expect(tree.comment).toContain('The Immortal Game');
    expect(line.some((node) => node.comment?.includes("King's Gambit"))).toBe(true);
  });

  it('carries the arrows, with the tags kept out of the prose', () => {
    expect(line.some((node) => node.shapes.length > 0)).toBe(true);
    expect(line.every((node) => !node.comment?.includes('%cal'))).toBe(true);
  });
});
