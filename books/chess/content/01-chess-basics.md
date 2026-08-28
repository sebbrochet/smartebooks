# 1. A chess game, move by move

Smart ebooks support **domain islands**. This chess book adds a board and a puzzle —
powered by a separate `@smart-ebooks/islands-chess` package, **not** the core engine. Books
that don't need chess never pay for it.

## Replay a famous miniature

Step through the game with the controls under the board. This book sets `theme=blue`
as its board default; this directive adds `pieces=unicode`, and `analysis=on` gives an
on-demand **Stockfish** evaluation of whatever position you've navigated to.

:::chess-board{id="chess-scholars" pieces=unicode analysis=on}
```pgn
1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
```
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
here, the Ruy Lopez after 3.Bb5.

::chess-analysis{id="chess-ruy-lopez" fen="r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"}

Stockfish runs **in your browser**, as a WebAssembly worker. Nothing about the position is sent
anywhere.

::checkpoint{id="chess-done" label="I explored the chess islands"}
