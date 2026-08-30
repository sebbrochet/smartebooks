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

## Try a puzzle

White to move and mate in one. Think first, then reveal. This puzzle uses the
`green` board theme.

:::chess-puzzle{id="chess-backrank" theme=green fen="6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"}
Ra8# — a back-rank mate.
:::

::checkpoint{id="chess-done" label="I explored the chess islands"}
