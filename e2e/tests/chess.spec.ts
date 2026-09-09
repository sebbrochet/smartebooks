import { test, expect, type Locator, type Page } from '@playwright/test';

test('chess board island renders and navigates moves', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  await expect(page.getByRole('heading', { name: /A chess game, move by move/ })).toBeVisible();

  // The lazy chess island loads; the move status starts at the beginning.
  const status = page.getByTestId('chess-move');
  await expect(status).toHaveText('Start');

  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(status).toHaveText(/1\.\s*e4/);

  // A chessground board is present.
  await expect(page.locator('.chessboard-island .cg-wrap').first()).toBeVisible();
});

test('the board shows the annotation for the move you are on', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');

  const status = page.getByTestId('chess-move');
  const comment = page.getByTestId('chess-comment');
  const next = page.getByRole('button', { name: 'Next move' });

  // A comment written before the first move introduces the game.
  await expect(comment).toContainText(/Scholar's Mate/);

  // Chess numbers moves, not plies: Black's reply to 1. e4 is still move one.
  await next.click();
  await expect(status).toHaveText('1. e4');
  await next.click();
  await expect(status).toHaveText('1... e5');

  // An unannotated move shows no note at all, rather than an empty box.
  await expect(comment).toHaveCount(0);

  await next.click();
  await expect(comment).toContainText(/White eyes f7/);

  // NAGs render as chess writing spells them, beside the move.
  await next.click();
  await next.click();
  await expect(status).toHaveText('3. Qh5?!');
});

test('chess puzzle island reveals its solution', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  await page.getByRole('button', { name: 'Reveal solution' }).click();
  await expect(page.getByText(/Ra8#/)).toBeVisible();
});

/**
 * Chessground draws pieces as positioned elements, not per-square nodes, so a
 * square is a fraction of the board's box rather than a locator. Moves are
 * dragged rather than click-selected, because dragging is what a reader does
 * and it does not depend on the library's selection state surviving a redraw.
 */
async function playMove(page: Page, board: Locator, from: string, to: string) {
  // Mouse coordinates are viewport coordinates. The board sits well down a long
  // chapter, so without this the drag lands outside the window and nothing
  // happens — silently, because a miss is not an error.
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error('board has no box');
  const at = (square: string) => ({
    x: box.x + (box.width * ('abcdefgh'.indexOf(square[0]) + 0.5)) / 8,
    y: box.y + (box.height * (8 - (Number(square[1]) - 1) - 0.5)) / 8,
  });

  const start = at(from);
  const end = at(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

test('a puzzle with a solution marks the answer instead of asking you to', async ({ page }) => {
  await page.goto('/#/chess/03-a-game-from-a-file');

  const puzzle = page.getByTestId('chess-puzzle');
  const board = puzzle.locator('.chessboard-island__board');
  const state = page.getByTestId('chess-puzzle-state');

  // No self-marking checkbox, and no answer to peek at: the island knows.
  await expect(puzzle.getByRole('checkbox')).toHaveCount(0);
  await expect(puzzle.getByRole('button', { name: /Reveal solution/ })).toHaveCount(0);
  // The lazy island plus three boards on the page make the first paint slow on
  // a loaded machine.
  await expect(state).toHaveText('Your move.', { timeout: 20_000 });

  // A wrong move is refused and the position is put back, so the reader is
  // looking at the same question.
  await playMove(page, board, 'b2', 'b7');
  await expect(state).toHaveText(/Not that one/);

  // The hint is there for the asking, and only for the asking.
  await puzzle.getByRole('button', { name: 'Hint' }).click();
  await expect(puzzle.getByText(/holds the back rank/)).toBeVisible();

  // The solution is a line: the island plays Black's reply, and the reader
  // answers the second move too.
  await playMove(page, board, 'b2', 'b8');
  await expect(state).toHaveText(/Right/);

  // Black has recaptured on b8, so the mate is the other rook taking it.
  await playMove(page, board, 'b1', 'b8');
  await expect(state).toHaveText('Solved');
  await expect(puzzle.getByText(/only defender of the back rank/)).toBeVisible();
});

test('a board can take its game from a packaged PGN file', async ({ page }) => {
  await page.goto('/#/chess/03-a-game-from-a-file');

  const list = page.getByTestId('chess-move-list');
  // Nothing in the chapter's Markdown carries these moves — they are read from
  // assets/immortal.pgn at render time.
  await expect(list.getByRole('button', { name: '1. e4' })).toBeVisible();
  await expect(list.getByRole('button', { name: '23. Be7#' })).toBeVisible();
  await expect(list.getByText(/most famous game ever played/)).toBeVisible();

  await list.getByRole('button', { name: '23. Be7#' }).click();
  await expect(page.getByTestId('chess-move')).toHaveText('23. Be7#');
});

test('stockfish analysis of the current board position', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  // Navigate a move so we analyze a live position, then ask the engine.
  await page.getByRole('button', { name: 'Next move' }).click();
  // Scoped to the board: the chapter also has a puzzle board, and an unscoped
  // locator matches both.
  const board = page.locator('.chessboard-island');
  await board.getByRole('button', { name: /Analyze with Stockfish/ }).click();
  // The 7 MB WASM engine loads then searches — give it room on a loaded machine.
  await expect(board.getByTestId('chess-eval')).toBeVisible({ timeout: 90_000 });
});

test('a diagram is a position with a caption and nothing to click', async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const diagram = page.locator('.chess-diagram');
  await expect(diagram.locator('.cg-wrap')).toBeVisible();
  await expect(diagram.getByText(/the bishop guards the queen/i)).toBeVisible();

  // The point of a separate island: no controls, no reveal, no checkbox.
  await expect(diagram.getByRole('button')).toHaveCount(0);
  await expect(diagram.getByRole('checkbox')).toHaveCount(0);

  // `orientation` defaults to `auto`, and it is Black to move in this position,
  // so the board is drawn from Black's side.
  await expect(diagram.locator('coords.ranks')).toHaveClass(/black/);

  // The `shapes` attribute draws two arrows, in PGN's own token syntax.
  await expect(diagram.locator('svg.cg-shapes g line')).toHaveCount(2);
});

test('the annotator drew on the board, and the tags are not in the prose', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');

  const board = page.locator('.chessboard-island').first();
  const next = page.getByRole('button', { name: 'Next move' });

  // Nothing drawn on the starting position.
  await expect(board.locator('svg.cg-shapes g *')).toHaveCount(0);

  // 2. Bc4 carries one arrow and one highlighted square.
  await next.click();
  await next.click();
  await next.click();
  await expect(page.getByTestId('chess-move')).toHaveText('2. Bc4');
  await expect(board.locator('svg.cg-shapes g line')).toHaveCount(1);
  await expect(board.locator('svg.cg-shapes g circle')).toHaveCount(1);

  // The reader gets the prose, not "[%cal Gc4f7]".
  const comment = page.getByTestId('chess-comment');
  await expect(comment).toHaveText('White eyes f7, the square only the king defends.');

  // Shapes belong to a position: stepping on must clear them.
  await next.click();
  await expect(board.locator('svg.cg-shapes g *')).toHaveCount(0);
});

test("an annotator's evaluation is shown before any engine runs", async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const analysis = page.locator('.island--chess-analysis');
  await expect(analysis.getByTestId('chess-stated-eval')).toContainText('+0.20');
  await expect(analysis.getByTestId('chess-stated-eval')).toContainText('a6');

  // With a stated evaluation the engine checks an answer rather than producing
  // one, and the button says so.
  await expect(analysis.getByRole('button')).toHaveText(/Check with Stockfish/);
});

test('standalone analysis island evaluates its own position, and only on request', async ({
  page,
}) => {
  // SPEC008 C9 claimed an imported book "silently starts" a WASM worker. It
  // does not, and this is the check that says so: nothing runs until the reader
  // clicks. What is genuinely missing is a *declaration* a reader could see
  // before importing the book, which is SPEC001 P2.5's job, not the pack's.
  await page.addInitScript(() => {
    const Original = window.Worker;
    Object.defineProperty(window, '__workersStarted', { value: 0, writable: true });
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as unknown as { __workersStarted: number }).__workersStarted += 1;
      }
    };
  });

  await page.goto('/#/chess/02-reading-an-annotated-game');

  // `::chess-analysis` has no board to navigate — it evaluates the FEN it was
  // given. Covered because an island that ships undemonstrated and untested is
  // how this one sat unused for a release.
  const analysis = page.locator('.island--chess-analysis');
  await expect(analysis.getByTestId('chess-stated-eval')).toBeVisible();
  const started = () =>
    page.evaluate(() => (window as unknown as { __workersStarted: number }).__workersStarted);
  expect(await started()).toBe(0);

  await analysis.getByRole('button', { name: /with Stockfish/ }).click();
  await expect(analysis.getByTestId('chess-eval')).toBeVisible({ timeout: 90_000 });
  expect(await started()).toBeGreaterThan(0);
});

test('the move list shows the whole game and drives the board', async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const list = page.getByTestId('chess-move-list');
  const status = page.getByTestId('chess-move');

  // The whole score is on the page, not one move at a time.
  await expect(list.getByRole('button', { name: '1. e4' })).toBeVisible();
  await expect(list.getByRole('button', { name: '7. Nd5#' })).toBeVisible();

  // Commentary breaks the score into paragraphs, the way a chess book sets it.
  await expect(list.getByText(/Ignoring the pin/)).toBeVisible();

  // Clicking a move jumps the board to it — the point of the list.
  await list.getByRole('button', { name: '5. Nxe5!!' }).click();
  await expect(status).toHaveText('5. Nxe5!!');
  await expect(list.getByRole('button', { name: '5. Nxe5!!' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  // And the annotation for that move is the live region, not a second copy of
  // the same sentence beneath the board.
  await expect(page.getByTestId('chess-comment')).toHaveCount(1);
});

test('a sideline is shown, and can be stepped into', async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const list = page.getByTestId('chess-move-list');
  const status = page.getByTestId('chess-move');

  // The sideline is present at all — a flat list of positions dropped it.
  const sideline = list.locator('.is-sideline');
  await expect(sideline).toBeVisible();
  await expect(sideline.getByText(/The refutation/)).toBeVisible();

  // Its moves are alternatives to the mainline move above, and they are
  // reachable: a ply index could not have named them.
  await sideline.getByRole('button', { name: '5... Nxe5' }).click();
  await expect(status).toHaveText('5... Nxe5');

  // Stepping forward stays inside the sideline rather than snapping back to
  // the main line.
  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(status).toHaveText('6. Qxg4');

  // And stepping back leaves it the way it came.
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(status).toHaveText('5... Nxe5');
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(status).toHaveText('5. Nxe5!!');
});

test('a focused board steps with the arrow keys', async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const status = page.getByTestId('chess-move');
  await expect(status).toHaveText('Start');

  // By role, not by class: a diagram reuses the board's sizing class, so
  // `.chessboard-island__board` matches two elements on this page.
  const board = page.getByRole('group', { name: /Chess board/ });
  await board.focus();

  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('1. e4');
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('1... e5');
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText('1. e4');

  await page.keyboard.press('End');
  await expect(status).toHaveText('7. Nd5#');
  await page.keyboard.press('Home');
  await expect(status).toHaveText('Start');
});

/**
 * SPEC001 P2.10 / SPEC008 G4: a container island owning the position, with the
 * boards, the score and the prose as its children.
 */
test('a move named in a sentence drives every board on the page', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  // `.chess-move` is the inline mark; `.chess-moves__move` is a move in the
  // score, and the two class names differ by more than they look.
  const mark = (name: string) => page.locator('.chess-move', { hasText: name });
  const status = page.getByTestId('chess-move');
  const list = page.getByTestId('chess-move-list');

  // The marks are inside the prose, not in a box of their own: the paragraph
  // containing one also contains the sentence around it.
  await expect(mark('1. e4').first()).toBeVisible();
  await expect(page.locator('p', { hasText: 'taking the centre' })).toContainText('1. e4');

  await expect(status).toHaveText('Start');

  await mark('2. Bc4').first().click();

  // The live board followed the sentence…
  await expect(status).toHaveText('2. Bc4');
  // …and so did the score, which is a separate island reading the same position.
  await expect(list.getByRole('button', { name: '2. Bc4' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

/**
 * It is still a board, at both widths.
 *
 * G7.4 sized one with `height: min(100%, 42vh)` against a parent of
 * `height: auto`; a percentage with nothing to resolve against collapses
 * inside `min()`, the board rendered 0px tall, and every assertion kept
 * passing, because a board of zero height is still in the viewport.
 *
 * G9.2 then did it again in the *width* axis, in a `@media (min-width: 900px)`
 * branch — two rules below a comment warning about it. Nothing caught it,
 * because the layout test runs at 390px and the fault only exists above 900.
 * Hence both widths here: a board sized per breakpoint needs checking per
 * breakpoint.
 */
test('the board is a board, at every width', async ({ page }) => {
  for (const [width, height] of [
    [390, 700],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/#/chess/04-a-game-you-can-lay-out');

    const board = page.locator('.chess-game__board .chessboard-island__board');
    await board.waitFor();
    const box = await board.boundingBox();

    expect(box.height, `${width}px: the board has collapsed`).toBeGreaterThan(150);
    expect(
      Math.abs(box.width - box.height),
      `${width}px: the board is ${Math.round(box.width)}×${Math.round(box.height)}`,
    ).toBeLessThan(2);
    // And it has left room to read in.
    expect(box.height, `${width}px: the board has eaten the prose`).toBeLessThan(height * 0.6);
  }
});

/**
 * SPEC008 G9.2 — the board is chrome, not content.
 *
 * **The test §7.10 asked for and never got.** Every other chess test clicks a
 * move while the board is comfortably on screen, which is exactly why C18
 * shipped, was "fixed" with sticky, and came back. The assertion has to be:
 * read to the end of the annotation, and is the board still there?
 *
 * It is, and for a structural reason rather than a CSS trick — the board is
 * not in the prose flow at all, so there is nothing for scrolling to take
 * away. Sticky lifted a box out of flow and produced overlap; this moves the
 * prose *under* nothing.
 */
test('the board holds still while the prose scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const board = page.locator('.chess-game__board .chessboard-island__board');
  const prose = page.getByTestId('chess-game-prose');
  await board.waitFor();
  await board.scrollIntoViewIfNeeded();
  await expect(board).toBeInViewport();

  const before = await board.boundingBox();

  // The premise: this game has more annotation than fits beside its board, and
  // the prose is a scrollport of its own. Without both, the test would pass
  // against a board that never moved because nothing ever scrolled.
  const pane = await prose.evaluate((n) => ({
    clipped: n.scrollHeight > n.clientHeight + 1,
    overflowY: getComputedStyle(n).overflowY,
  }));
  expect(pane.overflowY, 'the prose should be a pane the reader scrolls').toBe('auto');
  expect(pane.clipped, 'the game should be longer than its pane').toBe(true);

  // Read to the very end of it…
  await prose.evaluate((n) => n.scrollTo(0, n.scrollHeight));

  // …and the board has not moved a pixel.
  const after = await board.boundingBox();
  await expect(board).toBeInViewport();
  expect(
    Math.abs(before.y - after.y),
    `the board moved ${Math.round(Math.abs(before.y - after.y))}px`,
  ).toBeLessThan(1);

  // And the last mark in the annotation still drives it, where the reader can
  // see it happen. That is the whole of C18 in one assertion.
  await prose.locator('.chess-move', { hasText: '4. Qxf7#' }).first().click();
  await expect(page.getByTestId('chess-move')).toHaveText('4. Qxf7#');
  await expect(board).toBeInViewport();
});

/**
 * The other half: a diagram *is* content, and content moves.
 *
 * This test used to assert the same thing against the page scroll, when the
 * whole game sat in the document flow and sticky had made two boards pin and
 * overlap. The chapter's claim is unchanged — "it does not follow the reader,
 * it marks a moment" — but the thing it must not follow is now the pane.
 */
test('a diagram in a game moves with the prose that holds it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const board = page.locator('.chess-game__board .chessboard-island__board');
  // By its own class, not by position in the pane: the game holds two diagrams
  // now, and "the first board in the prose" would be a locator that quietly
  // changes meaning the next time the chapter is edited.
  const diagram = page.locator('.chess-diagram--opens .chessboard-island__board');
  const prose = page.getByTestId('chess-game-prose');
  await diagram.waitFor();

  const boardBefore = await board.boundingBox();
  const diagramBefore = await diagram.boundingBox();

  await prose.evaluate((n) => n.scrollBy(0, 120));

  const boardAfter = await board.boundingBox();
  const diagramAfter = await diagram.boundingBox();

  // 120px of pane travelled by the diagram, none by the board.
  expect(
    Math.abs(diagramBefore.y - diagramAfter.y - 120),
    `the diagram moved ${Math.round(diagramBefore.y - diagramAfter.y)}px for 120px of scroll`,
  ).toBeLessThan(4);
  expect(Math.abs(boardBefore.y - boardAfter.y), 'the board moved with it').toBeLessThan(1);
});

/**
 * SPEC008 §4.1.1. A shown score caps its own height, so the board stays on
 * screen while the reader works through it.
 *
 * `moves=on` used to mean uncapped, and the difference was invisible in review
 * because the demo game is short. Read on a phone it was not: the score ran
 * past the screen, the board went with it, and since every move is a button the
 * reader could click one and never see what it did.
 *
 * Asserted on the `on` chapter specifically, because `scroll` was always fine.
 */
/**
 * SPEC008 G9.3 — a diagram is an input.
 *
 * Half of this row already shipped with G4.1: `:move[…]` has driven the board
 * since 2026-09-01, and the test above proves it. What did not was the other
 * half, which is ForwardChess's move — the thing that makes "prose holds
 * diagrams, one board is live" a coherent pair rather than a compromise.
 *
 * The position is matched against the game rather than declared, so the author
 * writes nothing: a diagram this game reaches becomes a control, one it does
 * not stays a figure. Both halves are asserted, because the second is what
 * stops the feature from being a guess.
 */
test('tapping a diagram puts its position on the board', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const status = page.getByTestId('chess-move');
  const diagram = page.locator('.chess-diagram--opens .chessboard-island__board');
  await expect(status).toHaveText('Start');

  // The refutation, printed in the prose where it belongs.
  await expect(diagram).toHaveCount(1);
  await diagram.click();

  // The live board is showing it, named as the move that reaches it.
  await expect(status).toHaveText('3... g6');
  // …and the diagram says it is the one being shown.
  await expect(diagram).toHaveAttribute('aria-current', 'true');
});

test('a pinned board is a way back to the position it marks', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const status = page.getByTestId('chess-move');
  const pinned = page.getByRole('button', { name: /Chess diagram: 4\. Qxf7#/ });

  await page.locator('.chess-move', { hasText: '1. e4' }).first().click();
  await expect(status).toHaveText('1. e4');

  await pinned.click();
  await expect(status).toHaveText('4. Qxf7#');
});

/**
 * C15 said a diagram is not a control and took its focus away. G9.3 reverses
 * that, and the reversal is only honest if the keyboard comes with it — a
 * control reachable by mouse alone is the regression C15 existed to prevent.
 */
test('a diagram can be reached and used from the keyboard', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const status = page.getByTestId('chess-move');
  const diagram = page.locator('.chess-diagram--opens .chessboard-island__board');

  await diagram.focus();
  await expect(diagram).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText('3... g6');

  // Space too, and it must not scroll the page instead.
  await page.locator('.chess-move', { hasText: '1. e4' }).first().click();
  await expect(status).toHaveText('1. e4');
  await diagram.focus();
  await page.keyboard.press(' ');
  await expect(status).toHaveText('3... g6');
});

/**
 * The half that keeps the feature honest. Chapter 2's diagram is a position
 * from the same opening, but it is not inside any game — so there is no board
 * to send it to, and it stays what a diagram has always been.
 */
test('a diagram outside a game is still just a figure', async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const diagram = page.locator('.chess-diagram');
  await expect(diagram).toHaveCount(1);
  await expect(diagram).not.toHaveClass(/chess-diagram--opens/);
  await expect(diagram.locator('[role="button"]')).toHaveCount(0);
});

test('a score keeps its board on screen instead of pushing it away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/#/chess/02-reading-an-annotated-game');

  const board = page.locator('.chessboard-island__board').first();
  const moves = page.locator('.chess-moves').first();
  await moves.waitFor();

  // The pane scrolls itself rather than taking the page with it.
  const scrollable = await moves.evaluate((n) => n.scrollHeight > n.clientHeight + 1);
  expect(scrollable, 'the score should be a pane the reader scrolls').toBe(true);

  await board.scrollIntoViewIfNeeded();
  await expect(board).toBeInViewport();

  // Reading to the end of the score must not cost the board.
  await moves.evaluate((n) => n.scrollTo(0, n.scrollHeight));
  await expect(board).toBeInViewport();
});

test('a pinned board stays where it was put', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');
  // Three boards: the game's live one, an `at=` diagram and a `::chess-diagram`.
  await expect(page.locator('.chessboard-island .cg-wrap, .chess-diagram .cg-wrap')).toHaveCount(3);

  // The pinned one is a diagram: a caption naming its move, and no navigation.
  const pinned = page.locator('.chessboard-island', {
    has: page.locator('.chess-diagram__caption'),
  });
  await expect(pinned.locator('.chess-diagram__caption')).toHaveText('4. Qxf7#');
  /*
   * It has no *controls* — no first/previous/next, because it does not step
   * through anything. Since G9.3 the board itself is a button, which is a
   * different claim: it marks one moment, and touching that moment sends it to
   * the live board. C15's "a diagram is not a control" was true while a diagram
   * only ever displayed.
   */
  await expect(pinned.getByRole('button', { name: /move/i })).toHaveCount(0);
  await expect(pinned.locator('.chessboard-island__buttons')).toHaveCount(0);

  // Moving the reader does not move it — that is the whole point of a diagram.
  await page.locator('.chess-move', { hasText: '1. e4' }).first().click();
  await expect(page.getByTestId('chess-move')).toHaveText('1. e4');
  await expect(pinned.locator('.chess-diagram__caption')).toHaveText('4. Qxf7#');
});

// A board inside a game is still a board. The first cut of the container form
// dropped `analysis` — silently, because it stayed a declared attribute of
// `chess-board`, so the directive lint-passed and did nothing.
test('a board inside a game still offers the engine, and follows the reader', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const live = page.getByRole('group', { name: /Chess board/ });
  const analysis = page.locator('.chessboard-island__analysis');

  // Exactly one board opted in, and it is the live one — not the pinned diagram.
  await expect(analysis).toHaveCount(1);
  await expect(analysis.getByRole('button', { name: /Stockfish/ })).toBeVisible();

  // The engine is bound to the position the container publishes, so a move
  // named in the prose changes what would be analysed.
  await page.locator('.chess-move', { hasText: '2. Bc4' }).first().click();
  await expect(page.getByTestId('chess-move')).toHaveText('2. Bc4');
  await expect(live).toBeVisible();
});

test('a board inside a game steps with the arrow keys too', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  const status = page.getByTestId('chess-move');
  await expect(status).toHaveText('Start');

  // Only the live board is a focusable group; the pinned one is a diagram.
  const board = page.getByRole('group', { name: /Chess board/ });
  await expect(board).toHaveCount(1);
  await board.focus();

  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('1. e4');
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText('1... e5');
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText('1. e4');

  await page.keyboard.press('End');
  await expect(status).toHaveText('4. Qxf7#');
  await page.keyboard.press('Home');
  await expect(status).toHaveText('Start');
});
