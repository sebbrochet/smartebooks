# 1. A chess game, move by move

Smart ebooks support **domain islands**. This chess book adds a board and a puzzle —
powered by a separate `@smart-ebooks/islands-chess` package, **not** the core engine. Books
that don't need chess never pay for it.

## Replay a famous miniature

Step through the game with the controls under the board. This book sets `theme=blue`
as its board default; this directive adds `pieces=unicode`, and `analysis=on` gives an
on-demand **Stockfish** evaluation of whatever position you've navigated to.

The PGN carries the annotator's `{…}` comments and `$` glyphs, and the board shows them
as you step — so a game can be *read*, not just replayed. Comments can also carry
**arrows and highlights** (`[%cal …]`, `[%csl …]`), which are drawn on the board and
removed from the text.

:::chess-board{id="chess-scholars" pieces=unicode analysis=on}

```pgn
{Scholar's Mate: the four-move trap every beginner meets once, from either side.}
1. e4 e5 2. Bc4 {White eyes f7, the square only the king defends. [%cal Gc4f7] [%csl Rf7]} Nc6
3. Qh5?! {A second attacker on f7 — but bringing the queen out this early is
dubious, and Black has a clean answer in 3...g6. [%cal Gh5f7]} Nf6?? {The natural developing
move loses on the spot.} 4. Qxf7# {Mate: the bishop guards the queen.}
```

:::

## Show a position

`::chess-diagram` is a position and nothing else — no controls, no engine, no saved state.
It is what a printed chess book uses, and it takes the same arrow syntax as the PGN above.
The caption can be the directive's body, as here, or a `caption` attribute when you want the
one-line leaf form. This one sets no `orientation`, so the default `auto` shows it from the
side to move: Black, who is the one being mated.

:::chess-diagram{id="chess-mate" fen="r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4" shapes="Gc4f7 Rf7e8"}
The finish: the bishop guards the queen, and the king has nowhere to go.
:::

## Try a puzzle

White to move and mate in one. Think first, then reveal. This puzzle uses the
`green` board theme.

:::chess-puzzle{id="chess-backrank" theme=green fen="6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"}
Ra8# — a back-rank mate.
:::

## Analyse one position

`::chess-analysis` is the analysis on its own, without a board to navigate: give it a position
and it evaluates just that. Useful when the point is the *assessment* rather than the moves —
here, the Ruy Lopez after 3.Bb5. `eval` and `best` state the annotator's own verdict, so the
reader sees an answer before any engine runs — and still sees one in an export, in print, or
with JavaScript switched off.

::chess-analysis{id="chess-ruy-lopez" fen="r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" eval="+0.20" best="a6" depth=16}

Stockfish runs **in your browser**, as a WebAssembly worker. Nothing about the position is sent
anywhere.

::checkpoint{id="chess-done" label="I explored the chess islands"}
