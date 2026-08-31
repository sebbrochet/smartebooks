# 4. A game you can lay out yourself

Every board so far has been a box: the board on top, the controls under it, the
commentary somewhere else on the page. Printed chess books have never been laid
out that way. They interleave — a paragraph, a diagram at the critical moment,
more prose, the score at the end — and the moves are named *inside the
sentences*, not in a separate list.

`:::chess-game` is that. It owns the game and the position and draws nothing
itself; you place the boards, the score and the prose wherever they belong.

:::chess-game{id="chess-scholars-game" pieces=unicode}

```pgn
1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? {Developing, and losing. [%cal Rh5f7][%csl Rf7]}
(3... g6 {The move. The queen is chased and Black is fine.} 4. Qf3 Nf6)
4. Qxf7# {Scholar's mate.}
```

White opens with :move[1. e4], taking the centre, and Black mirrors with
:move[e5]. So far, an utterly standard opening.

::chess-board{analysis}

Now :move[2. Bc4] eyes the weak **f7** square — defended by nothing but the king
— and :move[3. Qh5] threatens mate in one. It looks terrifying and is in fact
premature: Black can simply develop, and the queen becomes a target. The
sideline in the score shows :move[3... g6], which is the move.

Every mark above is a button. Click one and the board follows it — and so does
every other board on this page, and the score below, because they are all
reading the same position from the same container.

::chess-moves{scroll=false}

After :move[4. Qxf7#] it is over. A board with `at` stays where it is put, which
is what a printed diagram does: it does not follow the reader, it marks a
moment.

::chess-board{at="4. Qxf7#"}

The final position is worth remembering: Black never developed a piece.

:::

Two things follow from the container owning the position rather than the board.
The first is that **the number of boards stops mattering** — zero, one or a
dozen, pinned or live, all in step. The second is that a move can be *mentioned*
without being displayed, so the prose reads like prose.

A board inside a game is still a board: the one above takes `analysis`, and the
engine evaluates whatever position the reader is on — including one they reached
by clicking a move in a sentence.

::checkpoint{id="chess-layout-done" label="I read a game laid out as prose"}
