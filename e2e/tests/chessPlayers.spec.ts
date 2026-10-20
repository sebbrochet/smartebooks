import { test, expect, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

const MOVES = '1. e4 c6 (1... e5 2. Nf3) 2. d4 d5';
const WHITE = 'Greet, Andrew';
const BLACK = 'Arkell, Keith';

async function openGame(
  page: Page,
  { white = WHITE, black = BLACK, packaged = false, orientation = 'black' } = {},
) {
  const pgn = `[White "${white}"]\n[Black "${black}"]\n\n${MOVES}`;
  const body = [
    '# Player names',
    '',
    `:::chess-game{id="players" orientation=${orientation}${packaged ? ' pgn="assets/game.pgn"' : ''}}`,
    '',
    ...(packaged ? [] : ['```pgn', pgn, '```', '']),
    ...Array.from({ length: 8 }, () => 'Explore :move[1. e4] and the sideline :move[2. Nf3].\n'),
    '::chess-board{at="1. e4"}',
    '',
    ':::',
  ].join('\n');
  const manifest = {
    schemaVersion: 2,
    authorId: 'example.com',
    slug: 'player-names',
    title: 'Player Names Test',
    visibility: 'private',
    chapters: [{ file: '01-game.md', order: 1 }],
    islands: { packs: { chess: {} } },
    assets: packaged ? ['assets/game.pgn'] : [],
  };
  const buffer = Buffer.from(
    zipSync({
      'smartbook.json': strToU8(JSON.stringify(manifest)),
      'content/01-game.md': strToU8(body),
      ...(packaged ? { 'assets/game.pgn': strToU8(pgn) } : {}),
    }),
  );
  await page.goto('/');
  await page.getByTestId('import-book-input').setInputFiles({
    name: 'players.smartbook',
    mimeType: 'application/zip',
    buffer,
  });
  await page.getByRole('link', { name: /Player Names Test/ }).click();
  await expect(page.getByTestId('chess-move')).toHaveText('Start', { timeout: 30_000 });
}

for (const packaged of [false, true]) {
  test(`player names follow orientation and navigation in ${packaged ? 'packaged' : 'inline'} PGN`, async ({
    page,
  }) => {
    await openGame(page, { packaged });
    const rows = page.locator('.chess-player__label');
    await expect(rows).toHaveText([`White: ${WHITE}`, `Black: ${BLACK}`]);
    await expect(page.getByTestId('chess-game-prose').locator('.chess-player')).toHaveCount(0);
    await page.getByRole('button', { name: 'Next move' }).click();
    await expect(rows).toHaveText([`White: ${WHITE}`, `Black: ${BLACK}`]);
    await page.locator('.chess-move', { hasText: '2. Nf3' }).first().click();
    await expect(page.getByTestId('chess-move')).toHaveText('2. Nf3');
    await expect(rows).toHaveText([`White: ${WHITE}`, `Black: ${BLACK}`]);
    await page.reload();
    await expect(page.getByTestId('chess-move')).toHaveText('2. Nf3', { timeout: 30_000 });
    await expect(rows).toHaveText([`White: ${WHITE}`, `Black: ${BLACK}`]);
  });
}

test('player disclosures appear only for clipped names and follow resizing', async ({ page }) => {
  await openGame(page, { white: 'Alexandra de la Tour Martin' });
  const player = page.locator('.chess-player--top');
  await expect(page.locator('.chess-player summary')).toHaveCount(0);
  await player.locator('.chess-player__label').click();
  await expect(page.locator('.chess-player__full')).toHaveCount(0);

  await page.setViewportSize({ width: 740, height: 360 });
  await expect(player.locator('summary')).toBeVisible();
  expect(
    await player
      .locator('summary')
      .evaluate((element) => getComputedStyle(element, '::after').content),
  ).toBe('"+"');
  const clipped = await player
    .locator('.chess-player__name')
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(clipped).toBe(true);
  await player.locator('summary').press('Enter');
  await expect(player.locator('.chess-player__full')).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.chess-player summary')).toHaveCount(0);
  await expect(page.locator('.chess-player__full')).toHaveCount(0);
  await page.setViewportSize({ width: 740, height: 360 });
  await expect(player.locator('summary')).toBeVisible();
  await expect(player.locator('details')).not.toHaveAttribute('open');
});

test('named boards preserve their phone layout and expose long names on tap', async ({ page }) => {
  const white = `Élodie ${'de la Tour '.repeat(15)}<img src=x onerror=alert(1)>`;
  await openGame(page, { white, orientation: 'white' });
  await expect(page.locator('.chess-player__label')).toHaveText([
    `Black: ${BLACK}`,
    `White: ${white}`,
  ]);
  await expect(page.locator('.chess-game img')).toHaveCount(0);

  for (const [width, height] of [
    [320, 568],
    [390, 700],
    [740, 360],
    [844, 390],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    const game = page.getByTestId('chess-game');
    const board = game.locator('.chess-game__board .chessboard-island__board');
    const controls = game.locator('.chess-game__board .chessboard-island__controls');
    const prose = page.getByTestId('chess-game-prose');
    const boardBox = await board.boundingBox();
    const controlsBox = await controls.boundingBox();
    const proseBox = await prose.boundingBox();
    const gameBox = await game.boundingBox();
    const topBox = await game.locator('.chess-player--top').boundingBox();
    const bottomBox = await game.locator('.chess-player--bottom').boundingBox();
    if (!boardBox || !controlsBox || !proseBox || !gameBox || !topBox || !bottomBox)
      throw new Error('Incomplete game layout');
    const at = `${width}x${height}`;
    expect(boardBox.height, `${at}: board size`).toBeGreaterThan(100);
    expect(Math.abs(boardBox.width - boardBox.height), `${at}: square board`).toBeLessThan(2);
    expect(boardBox.height, `${at}: room for prose`).toBeLessThan(height * 0.6);
    expect(proseBox.height, `${at}: readable prose`).toBeGreaterThan(150);
    expect(topBox.y + topBox.height, `${at}: top name above board`).toBeLessThanOrEqual(boardBox.y);
    expect(bottomBox.y, `${at}: bottom name below board`).toBeGreaterThanOrEqual(
      boardBox.y + boardBox.height,
    );
    expect(
      bottomBox.y + bottomBox.height,
      `${at}: name does not overlap controls`,
    ).toBeLessThanOrEqual(controlsBox.y);
    expect(controlsBox.y + controlsBox.height, `${at}: controls inside game`).toBeLessThanOrEqual(
      gameBox.y + gameBox.height + 1,
    );
    if (width >= 640 && height <= 600) {
      expect(boardBox.x + boardBox.width, `${at}: board does not overlap prose`).toBeLessThan(
        proseBox.x,
      );
    } else {
      expect(
        controlsBox.y + controlsBox.height,
        `${at}: controls do not overlap prose`,
      ).toBeLessThanOrEqual(proseBox.y);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${at}: page overflow`).toBeLessThanOrEqual(1);
    const full = game.locator('.chess-player--bottom');
    await full.locator('summary').click();
    await expect(full.locator('details')).toHaveAttribute('open', '');
    await expect(full.locator('.chess-player__full')).toBeVisible();
    await expect(full.locator('.chess-player__full')).toHaveText(white);
    const popup = await full.locator('.chess-player__full').boundingBox();
    if (!popup) throw new Error('Full name not visible');
    expect(popup.x).toBeGreaterThanOrEqual(0);
    expect(popup.x + popup.width).toBeLessThanOrEqual(width + 1);
    await full.locator('summary').press('Enter');
    await expect(full.locator('details')).not.toHaveAttribute('open');
  }

  const full = page.locator('.chess-player--bottom');
  await full.locator('summary').click();
  await page.emulateMedia({ media: 'print' });
  await expect(full.locator('.chess-player__full')).toBeHidden();
  const printed = await full.locator('.chess-player__name').evaluate((element) => ({
    width: element.clientWidth,
    contentWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(printed.contentWidth).toBeLessThanOrEqual(printed.width + 1);
  expect(printed.height).toBeGreaterThan(printed.lineHeight * 2);
});

test('the bundled model game identifies its players and reaches the final fork', async ({
  page,
}) => {
  await page.goto('/#/chess/06-a-model-game');
  await expect(page.locator('.chess-player__label')).toHaveText([
    `White: ${WHITE}`,
    `Black: ${BLACK}`,
  ]);
  await page
    .getByRole('group', { name: 'Chess board — arrow keys step through the game' })
    .press('End');
  await expect(page.getByTestId('chess-move')).toHaveText('18... Nf3+');
});

test('headerless repertoire boards retain their compact layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#/chess/05-choosing-a-line');
  await expect(page.getByTestId('chess-move')).toHaveText('Start', { timeout: 30_000 });
  await expect(page.locator('.chess-player')).toHaveCount(0);
  await expect(page.locator('.chess-game__board--players')).toHaveCount(0);
});
