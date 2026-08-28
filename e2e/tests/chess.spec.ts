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

test('chess puzzle island reveals its solution', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  await page.getByRole('button', { name: 'Reveal solution' }).click();
  await expect(page.getByText(/Ra8#/)).toBeVisible();
});

test('stockfish analysis of the current board position', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  // Navigate a move so we analyze a live position, then ask the engine.
  await page.getByRole('button', { name: 'Next move' }).click();
  // Scoped to the board: the chapter also has a standalone analysis island,
  // and an unscoped locator matches both.
  const board = page.locator('.chessboard-island');
  await board.getByRole('button', { name: /Analyze with Stockfish/ }).click();
  // The 7 MB WASM engine loads then searches — give it room on a loaded machine.
  await expect(board.getByTestId('chess-eval')).toBeVisible({ timeout: 90_000 });
});

test('standalone analysis island evaluates its own position', async ({ page }) => {
  await page.goto('/#/chess/01-chess-basics');
  // `::chess-analysis` has no board to navigate — it evaluates the FEN it was
  // given. Covered because an island that ships undemonstrated and untested is
  // how this one sat unused for a release.
  const analysis = page.locator('.island--chess-analysis');
  await analysis.getByRole('button', { name: /Analyze with Stockfish/ }).click();
  await expect(analysis.getByTestId('chess-eval')).toBeVisible({ timeout: 90_000 });
});
