# 4. A game you can lay out yourself

Every board so far has been a box: the board on top, the controls under it, the
commentary somewhere else on the page. Printed chess books have never been laid
out that way. They interleave — a paragraph, a diagram at the critical moment,
more prose, the score at the end — and the moves are named *inside the
sentences*, not in a separate list.

`:::chess-game` is that. It owns the game and gives you one board that holds
still: the board sits above, the prose scrolls beneath it, and every mark in
that prose moves the pieces without ever moving out of sight.

:::chess-game{id="chess-scholars-game" pieces=unicode analysis}

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

Every mark above is a button. Click one and the board follows it — and so does
the score below, because they are all reading the same position from the same
container. However far down this commentary you have read, the board is still
there.

::chess-moves{scroll=false}

After :move[4. Qxf7#] it is over. A **diagram** is different: it stays where it
is put, exactly as a printed one does. It does not follow the reader, it marks a
moment.

::chess-board{at="4. Qxf7#"}

The final position is worth remembering: Black never developed a piece.

:::

Two things follow from the container owning the board rather than the prose.
The first is that **a game can be as long as it needs to be** — pages of
annotation against one board, which is what a real annotated game looks like
and what a board sitting in the middle of the text could never survive. The
second is that a move can be *mentioned* without being displayed, so the prose
reads like prose.

The engine is the game's, not a board's: `analysis` on `:::chess-game` puts
Stockfish under the one live board, and it evaluates whatever position the
reader is on — including one they reached by clicking a move in a sentence.

::checkpoint{id="chess-layout-done" label="I read a game laid out as prose"}
