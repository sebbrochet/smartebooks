# 1. A chess game, move by move

The games in this book are not pictures. Step through them, try the positions
yourself, and see what the annotator made of each one.

## Replay a famous miniature

Step through the game with the controls under the board. Where the annotator has
assessed a position, the assessment appears with it — `+0.35` means White stands
a little better, and the number is always from White's point of view. The bar
beside the board says the same thing at a glance, and greys out for a position
nobody assessed.

The annotator's notes appear as you go, so a game can be *read* and not only
replayed. Where a note points at a square or a line of attack, the board draws it
for you.

:::chess-board{id="chess-scholars" moves="on" evalBar="on"}

```pgn
{Scholar's Mate: the four-move trap every beginner meets once, from either side.}
1. e4 {[%eval 0.20]} e5 {[%eval 0.15]}
2. Bc4 {White eyes f7, the square only the king defends. [%cal Gc4f7] [%csl Rf7] [%eval 0.25]} Nc6 {[%eval 0.20]}
3. Qh5?! {A second attacker on f7 — but bringing the queen out this early is
dubious, and Black has a clean answer in 3...g6. [%cal Gh5f7] [%eval -0.35]} Nf6?? {The natural developing
move loses on the spot. [%eval #1]} 4. Qxf7# {Mate: the bishop guards the queen.}
```

:::

## Try a puzzle

White to move and mate in one. Think first, then reveal.

:::chess-puzzle{id="chess-backrank" fen="6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"}
Ra8# — a back-rank mate.
:::

::checkpoint{id="chess-done" label="I played through a game and tried a puzzle"}
