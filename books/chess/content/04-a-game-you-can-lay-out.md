# 4. A game you can lay out yourself

Every board so far has been a box: the board on top, the controls under it, the
commentary somewhere else on the page. Printed chess books have never been laid
out that way. They interleave — a paragraph, a diagram at the critical moment,
more prose, the score at the end — and the moves are named *inside the
sentences*, not in a separate list.

This chapter is laid out that way. One game, one board that holds still: the
board sits above, the prose scrolls beneath it, and every move named in that
prose shifts the pieces without ever moving out of sight.

:::chess-game{id="chess-scholars-game" analysis}

```pgn
1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? {Developing, and losing. [%cal Rh5f7][%csl Rf7]}
(3... g6 {The move. The queen is chased and Black is fine.} 4. Qf3 Nf6)
4. Qxf7# {Scholar's mate.}
```

White opens with :move[1. e4], taking the centre, and Black mirrors with
:move[e5]. So far, an utterly standard opening.

Now :move[2. Bc4] eyes the weak **f7** square — defended by nothing but the king
— and :move[3. Qh5] threatens mate in one. It looks terrifying and is in fact
premature: Black can simply develop, and the queen becomes a target. The
sideline in the score shows :move[3... g6], which is the move.

::chess-diagram{fen="r1bqkbnr/pppp1p1p/2n3p1/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4" caption="The refutation. Tap it."}

A **diagram** is a moment, printed where it belongs, exactly as a paper book
prints one. Here it is also a way in: tap it and the board above shows that
position. Nothing declares that — the diagram names a position, and this game
happens to reach it. A diagram of a position from some other game stays a
picture, with nothing to tap.

Every move above is a button too. Click one and the board follows it — and so
does the score below, because they are all reading the same game. However far
down this commentary you have read, the board is still there.

::chess-moves{scroll=false}

After :move[4. Qxf7#] it is over, and the last diagram is the position worth
remembering: Black never developed a piece.

::chess-board{at="4. Qxf7#"}

:::

Two things follow from the board belonging to the game rather than to any one
paragraph. The first is that **a game can be as long as it needs to be** — pages
of annotation against one board, which is what a real annotated game looks like
and what a board sitting in the middle of the text could never survive. The
second is that a move can be *mentioned* without being displayed, so the prose
reads like prose.

The evaluation belongs to the game too, rather than to any one board: Stockfish
sits under the board that holds still, and weighs up whatever position you are
on — including one you reached by clicking a move in a sentence, or by tapping a
diagram.

::checkpoint{id="chess-layout-done" label="I read a game laid out as prose"}
