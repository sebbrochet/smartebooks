import { lazy, type ComponentType } from 'react';
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
  PIECE_SETS,
  resolveBoardOptions,
  type BoardOptions,
} from './boardOptions';

export {
  BOARD_THEMES,
  PIECE_SETS,
  DEFAULT_BOARD_OPTIONS,
  resolveBoardOptions,
  type BoardOptions,
  type BoardTheme,
  type PieceSet,
} from './boardOptions';

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
  } as const;

  return [
    {
      name: 'chess-board',
      aliases: ['chessboard'],
      attributes: {
        ...boardAttributes,
        analysis: { type: 'boolean', default: false },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessBoardIsland'),
      ),
      extract: (node) => ({
        pgn: extractDirectiveCode(node) ?? mdastToText(node),
        board: board(node),
      }),
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
    },
    {
      // Stockfish (WASM) analysis of a position. `fen` comes straight from the
      // directive attributes, so no extractor is needed.
      name: 'chess-analysis',
      aliases: ['chessanalysis'],
      attributes: {
        fen: { type: 'string', required: true },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./StockfishAnalysisIsland'),
      ),
    },
  ];
}
