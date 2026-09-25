import { lazy, type ComponentType } from 'react';
import {
  attrText,
  extractDirectiveCode,
  mdastToText,
  type IslandComponentProps,
  type IslandDefinition,
} from '@smart-ebooks/engine';

export interface MusicIslandsOptions {
  /** This book's default stave width in pixels (a per-directive attribute wins). */
  width?: number;
}

/** Wide enough for a two-bar example without the engraver spreading it thin. */
export const DEFAULT_WIDTH = 520;

/**
 * Fetch what this pack loads on demand, so a book using it works offline.
 *
 * `abcjs` is imported by the components rather than by this module, so pulling
 * them pulls the engraver behind them. This module must stay free of it: it is
 * imported eagerly by the library, so a static import here would put 506 kB of
 * engraver in the entry chunk of every reader who never opens a music book.
 */
export async function preloadMusicIslands(): Promise<void> {
  await Promise.all([import('./MusicFigureIsland'), import('./MusicPieceIsland')]);
}

/**
 * The music islands for one book (SPEC017).
 *
 * Only `music-figure` so far: a printed example, silent and inert, which is
 * what a book about notation is mostly made of. The score that plays is a
 * later island and a much larger question (SPEC017 §4.1).
 *
 * The body is **ABC** and never MusicXML — SPEC017 §5.1. ABC is what a person
 * writes; MusicXML is what a program exports, and belongs in `assets/` when
 * `src` arrives.
 */
export function musicIslands(options: MusicIslandsOptions = {}): IslandDefinition[] {
  const bookWidth =
    typeof options.width === 'number' && options.width > 0 ? options.width : DEFAULT_WIDTH;

  return [
    {
      name: 'music-figure',
      aliases: ['musicfigure'],
      attributes: {
        caption: { type: 'string', default: '' },
        width: { type: 'number', default: bookWidth },
        // A tune the book ships rather than one written in the body. Only a
        // packaged file is ever read — see `useAbcSource`.
        src: { type: 'asset' },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./MusicFigureIsland'),
      ),
      extract: (node) => ({ abc: extractDirectiveCode(node) ?? mdastToText(node) }),
      /*
       * Without JavaScript the notes cannot be drawn, so the static form is the
       * ABC source — the same answer `mermaid` gives for the same reason
       * (SPEC017 §4.4). It is a weaker fallback than the chess pack's, because
       * a move list is what a printed chess book prints and ABC is not what a
       * printed music book prints. It identifies the example rather than
       * replacing it, which is the best available until P1.1 can emit an asset.
       *
       * The caption comes first and survives on its own, because "Example 3 —
       * the C major scale" is worth more to a reader than the source is.
       */
      fallback: (_node, data, ctx) => {
        const abc = ((data as { abc?: string })?.abc ?? '').trim();
        const caption = attrText(ctx.attributes.caption).trim();
        if (!abc && !caption) return undefined;

        const nodes = [];
        if (caption) {
          nodes.push({
            type: 'paragraph' as const,
            children: [
              {
                type: 'emphasis' as const,
                children: [{ type: 'text' as const, value: caption }],
              },
            ],
          });
        }
        if (abc) nodes.push({ type: 'code' as const, lang: 'abc', value: abc });
        return nodes;
      },
    },
    {
      /*
       * A piece with the prose written around it, and the notes in that prose
       * able to point at it (SPEC017 QN1). The second consumer `createSequence`
       * was designed for and had never had.
       */
      name: 'music-piece',
      aliases: ['musicpiece'],
      rendersChildren: true,
      attributes: {
        caption: { type: 'string', default: '' },
        width: { type: 'number', default: bookWidth },
        src: { type: 'asset' },
        // On by default: a piece the prose walks through is the one island here
        // that has something to play. An author who wants silence says so.
        play: { type: 'boolean', default: true },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./MusicPieceIsland'),
      ),
      // `consume` because the tune is the container's data, not something to
      // print twice — without it the body would render as the score *and*
      // again as a code listing inside the container's own children.
      extract: (node) => ({ abc: extractDirectiveCode(node, { consume: true }) ?? '' }),
      // No `fallback`: the container's children are the author's prose and the
      // engine keeps them. The tune itself has no static form here that the
      // prose does not already carry, and printing the source above an essay
      // about it would be noise rather than the example `music-figure` is.
    },
    {
      // `:note[G]` — a note named inside a sentence.
      name: 'note',
      inline: true,
      attributes: {
        nth: { type: 'number', default: 1 },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./MusicNoteIsland'),
      ),
      // No `fallback`: an inline island's children are its static form, and the
      // engine keeps them rather than replacing them.
    },
  ];
}
