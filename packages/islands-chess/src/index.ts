import { lazy, type ComponentType } from 'react';
import type { RootContent } from 'mdast';
import {
  extractDirectiveCode,
  mdastToText,
  type AttributeSpec,
  type IslandComponentProps,
  type IslandDefinition,
  type DirectiveNode,
} from '@smart-ebooks/engine';
import type { GameBoardProps } from './ChessBoardInGame';
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
 * Fetch everything this pack loads on demand, so a book that uses it works
 * with no network afterwards.
 *
 * The components are `lazy`, which is what keeps Chessground and a 7 MB engine
 * off the wire for readers who open neither. The cost is that "I have this
 * book" and "I can read this book" are different statements: the text of an
 * imported package is in IndexedDB the moment it lands, while the code that
 * draws a board is still a request waiting to happen. A reader who imported a
 * chess book at home and opened it on a train met the second half of that.
 *
 * The service worker caches what it sees fetched, so simply *asking* for these
 * modules is enough — this function does not need their exports and ignores
 * them.
 *
 * The engine is included because the reader asked for it: it is the difference
 * between a board and a board that can answer a question. It is also 7 MB, so
 * this is deliberately a per-book decision made by the descriptor declaring the
 * pack, not a default paid by every reader.
 */
export async function preloadChessIslands(base = '/'): Promise<void> {
  await Promise.all([
    import('./ChessBoardIsland'),
    import('./ChessPuzzleIsland'),
    import('./ChessDiagramIsland'),
    import('./ChessGameIsland'),
    import('./ChessMovesIsland'),
    import('./StockfishAnalysisIsland'),
    // Not a module: the engine is a worker script plus its WebAssembly, both
    // fetched by URL at run time. `no-store` would defeat the point — the
    // service worker's copy is exactly what is wanted here.
    ...[
      `${base}stockfish/stockfish-18-lite-single.js`,
      `${base}stockfish/stockfish-18-lite-single.wasm`,
    ].map((url) => fetch(url).catch(() => undefined)),
  ]);
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

  /**
   * Only the board attributes the author actually wrote.
   *
   * The schema's defaults are applied before a component ever sees
   * `attributes`, so by then "the book chose brown" and "this directive said
   * brown" are the same value and a container has no way to sit between them.
   * A diagram inside a `:::chess-game` needs exactly that, so the raw subset is
   * carried alongside the resolved options rather than recovered later.
   */
  const namedBoardAttributes = (node: DirectiveNode): Record<string, string> => {
    const attrs = directiveAttributes(node);
    const named: Record<string, string> = {};
    for (const key of ['theme', 'pieces', 'orientation']) {
      if (attrs[key] !== undefined) named[key] = attrs[key];
    }
    return named;
  };

  /**
   * **What a `::chess-board` inside a `:::chess-game` still gets a say in.**
   *
   * Keyed by `GameBoardProps` rather than written as a list: the dispatcher in
   * `ChessBoardIsland` hands the in-game branch a hand-written set of props,
   * and everything outside it is *not overridden but never delivered*. A
   * `Record<keyof GameBoardProps, true>` makes both directions a type error —
   * a prop added to the component and not named here, and a name here that is
   * not a prop.
   *
   * C16 closed this by naming the three attributes it had found; C25 was the
   * next three, and writing *that* row down got the count wrong, because
   * `shapes` is a fourth. A list maintained by hand was already stale on the
   * day it was specified, which is why this is derived (decision 18).
   */
  const IN_GAME_BOARD_ATTRIBUTES: Record<keyof GameBoardProps, true> = {
    at: true,
    analysis: true,
  };

  /**
   * Marks every attribute the in-game branch does not deliver as ignored there.
   *
   * Ignored-inside becomes the **default** for anything added to this island,
   * which is the safe direction: a new attribute that the container really does
   * honour fails loudly the first time a book uses it, where one silently doing
   * nothing is the bug this exists to end.
   */
  function containerOwns<T extends Record<string, AttributeSpec>>(attributes: T): T {
    return Object.fromEntries(
      Object.entries(attributes).map(([name, spec]) => [
        name,
        name in IN_GAME_BOARD_ATTRIBUTES ? spec : { ...spec, ignoredInside: 'chess-game' },
      ]),
    ) as T;
  }

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
      // Owns its position when it stands alone; owns nothing inside a game.
      stateful: { unlessInside: 'chess-game' },
      // Everything not named in IN_GAME_BOARD_ATTRIBUTES is reported as
      // `attribute-ignored` inside a game, because that is exactly what the
      // dispatcher does with it.
      attributes: containerOwns({
        ...boardAttributes,
        analysis: { type: 'boolean', default: false },
        // On by default: the arrows are already in the PGN, and silently
        // dropping an annotator's work is the worse failure.
        shapes: { type: 'boolean', default: true },
        // Off by default: a 60-move game would otherwise put a wall of text
        // under every board, and every existing chapter would change shape.
        // Inside a game the score is `::chess-moves`, placed where the author
        // wants it, so this attribute has nothing to do there.
        moves: {
          type: 'enum',
          values: MOVE_LIST_MODES,
          default: 'off',
        },
        // A packaged `.pgn` file, which is how real annotated material arrives.
        // Wins over the body when both are present. Inside a game the container
        // holds the game, so a child board has none of its own to name.
        pgn: { type: 'asset' },
        // Pins this board to one position, so a diagram stays put while the
        // reader moves on. There is no position to pin to without a container
        // publishing one, which is why SPEC008 §4.1.3 rejected `at` on a
        // standalone board rather than inventing a second meaning for it.
        at: { type: 'string', default: '', requiresInside: 'chess-game' },
      }),
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
      stateful: true,
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
        boardAttrs: namedBoardAttributes(node),
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
      stateful: true,
      attributes: {
        ...boardAttributes,
        shapes: { type: 'boolean', default: true },
        pgn: { type: 'asset' },
        // The engine under the game's own board. It moved here from the child
        // board when the container started providing one (SPEC008 G9.2): a
        // game has one live board, so `analysis` is a property of the game.
        analysis: { type: 'boolean', default: false },
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
