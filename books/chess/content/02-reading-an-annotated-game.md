# 2. Reading an annotated game

A board with four buttons lets you *replay* a game. It does not let you **read** one:
you can only see one move at a time, and you cannot tell where you are or skip ahead.
Printed chess books have always shown the whole score, with the commentary breaking it
into paragraphs. `moves=on` does the same, and every move is clickable.

## The whole score, at once

This is Légal's Mate, from 1750 — a queen sacrifice that still catches people out.
Click any move to jump the board to it, or focus the board and use the arrow keys.

:::chess-board{id="chess-legal" moves=on pieces=unicode}

```pgn
{Légal's Mate, Paris 1750. White gives up the queen and mates with the minor pieces.}
1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 {Pinning the knight — or so Black thinks.
The pin is real, but it is not absolute, and that is the whole game. [%cal Rg4d1]}
5. Nxe5!! {Ignoring the pin. The queen is hanging, and taking it loses.
[%cal Gf3e5][%csl Gd1]} Bxd1?? {5...Nxe5 6. Qxg4 Nxg4 was the answer: a pawn down,
but alive.} 6. Bxf7+ Ke7 7. Nd5# {Mate by two knights and a bishop, with the queen
still sitting on d1 for Black to admire.}
```

:::

Because the score is *text*, it is also what this board exports. Strip the interactivity —
print it, read it with JavaScript off, index it for search — and you get the moves and the
commentary, which is exactly what a chess book is.

## A position on its own

`::chess-diagram` is a position and nothing else — no controls, no engine, no saved state.
It takes the same arrow syntax as the PGN above. The caption can be the directive's body,
as here, or a `caption` attribute when you want the one-line leaf form. This one sets no
`orientation`, so the default `auto` shows it from the side to move: Black, who is about
to be mated.

:::chess-diagram{id="chess-mate" fen="r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4" shapes="Gc4f7 Rf7e8"}
Scholar's Mate, from chapter 1: the bishop guards the queen, and the king has nowhere to go.
:::

## An assessment, without a game

`::chess-analysis` is the analysis on its own, without a board to navigate: give it a position
and it evaluates just that. Useful when the point is the *assessment* rather than the moves —
here, the Ruy Lopez after 3.Bb5. `eval` and `best` state the annotator's own verdict, so the
reader sees an answer before any engine runs — and still sees one in an export, in print, or
with JavaScript switched off.

::chess-analysis{id="chess-ruy-lopez" fen="r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" eval="+0.20" best="a6" depth=16}

Stockfish runs **in your browser**, as a WebAssembly worker. Nothing about the position is sent
anywhere.

::checkpoint{id="chess-annotated-done" label="I read an annotated game"}
