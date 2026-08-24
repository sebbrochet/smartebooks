# 1. A chess game, move by move

Smart ebooks support **domain islands**. This chess book adds a board and a puzzle —
powered by a separate `@smart-ebooks/islands-chess` package, **not** the core engine. Books
that don't need chess never pay for it.

## Replay a famous miniature

Step through the game with the controls under the board. This book sets `theme=blue`
as its board default; this directive adds `pieces=unicode`, and `analysis=on` gives an
on-demand **Stockfish** evaluation of whatever position you've navigated to.

:::chessboard{id="chess-scholars" pieces=unicode analysis=on}
```pgn
1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
```
:::

## Try a puzzle

White to move and mate in one. Think first, then reveal. This puzzle uses the
`green` board theme.

:::chesspuzzle{id="chess-backrank" theme=green fen="6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"}
Ra8# — a back-rank mate.
:::

::checkpoint{id="chess-done" label="I explored the chess islands"}
