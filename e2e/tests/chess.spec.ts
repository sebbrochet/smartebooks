import { test, expect } from '@playwright/test';

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

test('standalone analysis island evaluates its own position', async ({ page }) => {
  await page.goto('/#/chess/02-reading-an-annotated-game');
  // `::chess-analysis` has no board to navigate — it evaluates the FEN it was
  // given. Covered because an island that ships undemonstrated and untested is
  // how this one sat unused for a release.
  const analysis = page.locator('.island--chess-analysis');
  await analysis.getByRole('button', { name: /with Stockfish/ }).click();
  await expect(analysis.getByTestId('chess-eval')).toBeVisible({ timeout: 90_000 });
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
