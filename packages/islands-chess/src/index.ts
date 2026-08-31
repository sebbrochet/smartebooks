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
export { play, playSan, positionFrom, sameMove, solutionMoves } from './puzzle';
export { useGame, useSequence, type ChessGame } from './gameContext';
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
        // A packaged `.pgn` file, which is how real annotated material arrives.
        // Wins over the body when both are present.
        pgn: { type: 'asset' },
        // Only meaningful inside a `:::chess-game`: pins this board to one
        // position, so a diagram stays put while the reader moves on.
        at: { type: 'string', default: '' },
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
      //
      // A game that lives in a packaged file cannot be reached from here at
      // all: a fallback runs at parse time and an asset is bytes on the book,
      // resolved per reader and per session. Such a board says where its game
      // is instead of pretending it has none (SPEC008 C13).
      fallback: (_node, data, ctx) => {
        const pgn = (data as { pgn?: string } | undefined)?.pgn ?? '';
        if (!pgn.trim()) {
          const file = typeof ctx.attributes.pgn === 'string' ? ctx.attributes.pgn : '';
          return file
            ? [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'text', value: 'Game: ' },
                    { type: 'inlineCode', value: file },
                  ],
                },
              ]
            : undefined;
        }

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
        // SAN, so the island can mark the answer. An attribute rather than a
        // body micro-format: the body stays the author's explanation, and
        // there is no second little language to learn or to lint.
        solution: { type: 'string', default: '' },
        hint: { type: 'string', default: '' },
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
    {
      // One game, several islands. The container owns the game and the
      // position; the boards, the score and the prose inside it follow
      // (SPEC001 §4.1, SPEC008 G4).
      name: 'chess-game',
      aliases: ['chessgame'],
      attributes: {
        ...boardAttributes,
        shapes: { type: 'boolean', default: true },
        pgn: { type: 'asset' },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessGameIsland'),
      ),
      // `consume` because the PGN is the container's data, not something to
      // print twice: without it the code block would render both as the game
      // and, inside the container's own children, as a code listing.
      extract: (node) => ({
        pgn: extractDirectiveCode(node, { consume: true }) ?? '',
        board: board(node),
      }),
      // Renders what the author wrote inside it, so the static form is the
      // author's own prose and the child islands' fallbacks. There is nothing
      // for a `fallback` to add.
      rendersChildren: true,
    },
    {
      // The game's score, driven by the surrounding `:::chess-game`. A leaf:
      // everything it shows comes from the container.
      name: 'chess-moves',
      aliases: ['chessmoves'],
      attributes: {
        scroll: { type: 'boolean', default: true },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessMovesIsland'),
      ),
    },
    {
      // A move named in a sentence: `:move[19. Bd6]`. Inline, so it can sit
      // inside a paragraph without breaking it (SPEC001 P2.6).
      name: 'move',
      inline: true,
      attributes: {},
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> =>
          import('./ChessMoveIsland'),
      ),
    },
  ];
}
