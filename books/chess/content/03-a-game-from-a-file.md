# 3. A game from a file, and a puzzle you have to solve

Real chess material — opening repertoires, annotated master games, database
exports — arrives as **PGN files**, with the commentary already inside them next
to each move. Retyping one into Markdown would be wasteful and lossy, so a board
can name a packaged file instead of carrying the moves in its body.

## The Immortal Game, from `assets/immortal.pgn`

`moves=scroll` caps the height of the score, because a 23-move game with
commentary is a lot of page. The arrows, the glyphs and the annotator's notes
all come from the file.

:::chess-board{id="chess-immortal" moves=scroll pgn="assets/immortal.pgn"}
:::

Only a **packaged** file is read. A board in an imported book cannot point this
attribute at a URL and have the reader's browser fetch it — the engine resolves
`assets/…` and reports what it resolved, and anything else is left alone.

There is a cost, and it is worth saying plainly: the static form of this board
is weaker than one whose moves are in its body. A fallback is produced when the
book is parsed, and a packaged asset is bytes that are only resolved per reader
and per session — so an export of this board can say where its game is, but not
what it is.

## A puzzle that knows whether you are right

Give a `chess-puzzle` a `solution` and it stops asking you to mark your own
work: play the move on the board and it will tell you. A solution can be a whole
line, and the island plays the replies.

White to play. There is a mate in two.

:::chess-puzzle{id="chess-deflection" fen="5rk1/5ppp/8/8/8/8/1R3PPP/1R4K1 w - - 0 1" solution="Rb8 Rxb8 Rxb8#" hint="Black's rook holds the back rank."}
The rook on f8 is the only defender of the back rank, so drive it off it.
:::

A puzzle with no `solution` keeps the older behaviour — reveal the answer, and
tick the box yourself — because an author with only prose to offer should not
have to invent notation. Chapter 1 has one of those.

::checkpoint{id="chess-file-done" label="I solved the puzzle"}
