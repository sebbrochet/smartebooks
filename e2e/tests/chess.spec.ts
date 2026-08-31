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

test('a pinned board stays where it was put', async ({ page }) => {
  await page.goto('/#/chess/04-a-game-you-can-lay-out');

  // Two boards, one live and one pinned with `at`.
  await expect(page.locator('.chessboard-island .cg-wrap')).toHaveCount(2);

  // The pinned one is a diagram: a caption naming its move, and no controls.
  const pinned = page.locator('.chessboard-island', {
    has: page.locator('.chess-diagram__caption'),
  });
  await expect(pinned.locator('.chess-diagram__caption')).toHaveText('4. Qxf7#');
  await expect(pinned.getByRole('button')).toHaveCount(0);

  // Moving the reader does not move it — that is the whole point of a diagram.
  await page.locator('.chess-move', { hasText: '1. e4' }).first().click();
  await expect(page.getByTestId('chess-move')).toHaveText('1. e4');
  await expect(pinned.locator('.chess-diagram__caption')).toHaveText('4. Qxf7#');
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
