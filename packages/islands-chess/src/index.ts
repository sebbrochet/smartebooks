import { lazy, type ComponentType } from 'react';
import type { RootContent } from 'mdast';
import {
  extractDirectiveCode,
  mdastToText,
  type IslandComponentProps,
  type IslandDefinition,
  type DirectiveNode,
} from '@smart-ebooks/engine';
import {
  BOARD_THEMES,
  DEFAULT_BOARD_OPTIONS,
  ORIENTATIONS,
  PIECE_SETS,
  resolveBoardOptions,
  type BoardOptions,
} from './boardOptions';
import { pgnScoreText } from './score';

/** `moves` on a board: hidden, full height, or capped with its own scrollport. */
export const MOVE_LIST_MODES = ['off', 'on', 'scroll'] as const;

export {
  BOARD_THEMES,
  PIECE_SETS,
  ORIENTATIONS,
  DEFAULT_BOARD_OPTIONS,
  orientationFor,
  resolveBoardOptions,
  type BoardOptions,
  type BoardTheme,
  type Orientation,
  type PieceSet,
} from './boardOptions';
export { extractShapes, parseShapes, type MoveShape } from './shapes';
export {
  mainline,
  mainlinePath,
  nodeAt,
  parentPath,
  pgnToTree,
  type GameNode,
  type GameTree,
} from './tree';
export { moveLabel, pgnScoreText, toScore, type Score, type ScoreSegment } from './score';

function directiveAttributes(node: DirectiveNode): Record<string, string> {
  const attrs =
    (node as { attributes?: Record<string, string | null | undefined> }).attributes ?? {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export interface ChessIslandsOptions {
  /** This book's default board theme / piece set (per-directive attrs win). */
  board?: Partial<BoardOptions>;
}

/**
 * Builds the chess islands for one book. Components are lazy so Chessground /
 * chessops / Stockfish only ship with books that use them, and the extractors
 * stay dependency-light (raw body + attributes) since they run at parse time.
 *
 * Board defaults are captured here rather than in module state, so two books
 * can use different themes. Each directive's options are resolved and validated
 * during extraction, so components receive a ready-made, safe `board`.
 */
export function chessIslands(options: ChessIslandsOptions = {}): IslandDefinition[] {
  const defaults: BoardOptions = {
    ...DEFAULT_BOARD_OPTIONS,
    ...resolveBoardOptions(options.board as Record<string, string> | undefined),
  };
  const board = (node: DirectiveNode): BoardOptions =>
    resolveBoardOptions(directiveAttributes(node), defaults);

  // The book's own defaults become the schema defaults, so a per-directive
  // attribute is validated by the engine and an invalid one falls back to what
  // this book chose rather than to the built-in.
  const boardAttributes = {
    theme: { type: 'enum', values: BOARD_THEMES, default: defaults.theme },
    pieces: { type: 'enum', values: PIECE_SETS, default: defaults.pieces },
    orientation: { type: 'enum', values: ORIENTATIONS, default: defaults.orientation },
  } as const;

  return [
    {
      name: 'chess-board',
      aliases: ['chessboard'],
      attributes: {
        ...boardAttributes,
        analysis: { type: 'boolean', default: false },
        // On by default: the arrows are already in the PGN, and silently
        // dropping an annotator's work is the worse failure.
        shapes: { type: 'boolean', default: true },
        // Off by default: a 60-move game would otherwise put a wall of text
        // under every board, and every existing chapter would change shape.
        moves: { type: 'enum', values: MOVE_LIST_MODES, default: 'off' },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessBoardIsland'),
      ),
      extract: (node) => ({
        pgn: extractDirectiveCode(node) ?? mdastToText(node),
        board: board(node),
      }),
      // A game printed the way chess books print it: runs of moves broken by
      // the annotator's commentary. Chess was filed as picture-shaped and so
      // exported as blank space; only the *diagram* is a picture, and a score
      // is text (SPEC008 C2).
      //
      // Built from the PGN text rather than from a replayed game, because this
      // runs at parse time in the module every reader loads — see the note in
      // `score.ts` for what replaying it here costs.
      fallback: (_node, data) => {
        const pgn = (data as { pgn?: string } | undefined)?.pgn ?? '';
        if (!pgn.trim()) return undefined;

        const { intro, blocks } = pgnScoreText(pgn);
        const paragraph = (value: string): RootContent => ({
          type: 'paragraph',
          children: [{ type: 'text', value }],
        });

        const out: RootContent[] = intro ? [paragraph(intro)] : [];
        for (const block of blocks) {
          out.push(paragraph(block.moves));
          if (block.comment) out.push(paragraph(block.comment));
        }
        return out.length > 0 ? out : undefined;
      },
    },
    {
      name: 'chess-puzzle',
      aliases: ['chesspuzzle'],
      attributes: {
        ...boardAttributes,
        fen: { type: 'string', required: true },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessPuzzleIsland'),
      ),
      extract: (node) => ({
        fen: directiveAttributes(node).fen ?? '',
        solution: extractDirectiveCode(node) ?? mdastToText(node),
        board: board(node),
      }),
      // Like a diagram, a puzzle's position needs `emitAsset` to print
      // properly. Its *solution*, though, is already prose, and losing that on
      // export is the worse half of the loss — a reader gets the position from
      // the FEN and the answer from the text.
      fallback: (_node, data) => {
        const { fen = '', solution = '' } = (data as { fen?: string; solution?: string }) ?? {};
        if (!fen) return undefined;
        return [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Puzzle position: ' },
              { type: 'inlineCode', value: fen },
            ],
          },
          ...(solution.trim()
            ? [
                {
                  type: 'paragraph' as const,
                  children: [
                    {
                      type: 'strong' as const,
                      children: [{ type: 'text' as const, value: 'Solution: ' }],
                    },
                    { type: 'text' as const, value: solution.trim() },
                  ],
                },
              ]
            : []),
        ];
      },
    },
    {
      // A position and nothing else. Distinct from `chess-board` rather than a
      // mode of it: no controls, no state, no engine, and a different static
      // form. See SPEC008 QC2.
      name: 'chess-diagram',
      aliases: ['chessdiagram'],
      attributes: {
        ...boardAttributes,
        fen: { type: 'string', required: true },
        caption: { type: 'string', default: '' },
        // A token list in PGN's own `%cal`/`%csl` spelling, e.g. "Gd1h5 Rf7".
        shapes: { type: 'string', default: '' },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessDiagramIsland'),
      ),
      // A caption reads better as prose in the body than as a quoted attribute,
      // and a FEN already spends 69 of a line's characters. Both spellings
      // work; the attribute wins, so the leaf form stays usable mid-flow.
      extract: (node) => ({
        fen: directiveAttributes(node).fen ?? '',
        caption: directiveAttributes(node).caption ?? mdastToText(node).trim(),
        board: board(node),
      }),
      // A diagram is the one genuinely picture-shaped thing in this pack, so a
      // faithful fallback needs build-time image emission (SPEC001 P1.1). Until
      // then the FEN and caption are emitted as text: a search indexer can read
      // them, a screen reader can announce them, and a chess reader can set the
      // position up. That beats the blank space they export as today.
      fallback: (_node, data) => {
        const { fen = '', caption = '' } = (data as { fen?: string; caption?: string }) ?? {};
        if (!fen) return undefined;
        return [
          {
            type: 'paragraph',
            children: [
              ...(caption ? [{ type: 'text' as const, value: `${caption} ` }] : []),
              { type: 'text', value: 'Position: ' },
              { type: 'inlineCode', value: fen },
            ],
          },
        ];
      },
    },
    {
      // Stockfish (WASM) analysis of a position. `fen` comes straight from the
      // directive attributes, so no extractor is needed.
      name: 'chess-analysis',
      aliases: ['chessanalysis'],
      attributes: {
        fen: { type: 'string', required: true },
        depth: { type: 'number', default: 14, min: 1, max: 30 },
        // The annotator's own assessment. Unlike the engine's, it survives
        // export, print and a reader with no JavaScript.
        eval: { type: 'string', default: '' },
        best: { type: 'string', default: '' },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./StockfishAnalysisIsland'),
      ),
      // Only a *stated* evaluation can appear in an export — running an engine
      // at build time is a different feature. With none, there is nothing
      // honest to say, so nothing is emitted.
      fallback: (_node, _data, ctx) => {
        const stated = typeof ctx.attributes.eval === 'string' ? ctx.attributes.eval : '';
        if (!stated) return undefined;
        const best = typeof ctx.attributes.best === 'string' ? ctx.attributes.best : '';
        return [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Evaluation: ' },
              { type: 'strong', children: [{ type: 'text', value: stated }] },
              ...(best ? [{ type: 'text' as const, value: ` · best ${best}` }] : []),
            ],
          },
        ];
      },
    },
  ];
}
