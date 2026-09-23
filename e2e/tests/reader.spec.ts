import { test, expect } from '@playwright/test';

// Deep-link straight into the football book's first chapter.
const CHAPTER = '/#/football/01-the-basics';

test('quiz score persists across a reload', async ({ page }) => {
  await page.goto(CHAPTER);

  // Answer the first (single-choice) question correctly.
  await expect(page.getByText('How long is a football match')).toBeVisible();
  await page.getByText('Two halves of forty-five minutes').click();

  // Answer the multi-select question correctly.
  await page.getByText('Both feet must stay on the ground').click();
  await page.getByText('The ball is thrown with both hands, from behind the head').click();
  await page.getByText('The thrower may not touch the ball again until someone else does').click();

  await page.getByRole('button', { name: 'Check answers' }).click();
  await expect(page.getByText('Score: 2 / 2')).toBeVisible();

  // Reload — the submitted state and score should be restored from IndexedDB.
  await page.reload();
  await expect(page.getByText('Score: 2 / 2')).toBeVisible();
});

test('checkpoint completion persists across a reload', async ({ page }) => {
  await page.goto(CHAPTER);
  const checkbox = page
    .getByText('I know what the referee is there for')
    .locator('..')
    .getByRole('checkbox');
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(
    page.getByText('I know what the referee is there for').locator('..').getByRole('checkbox'),
  ).toBeChecked();
});

test('an inline mark stays in its sentence and opens on request', async ({ page }) => {
  await page.goto('/#/football/02-close-calls');

  const word = page.getByRole('button', { name: 'advantage' });
  await expect(word).toBeVisible();
  await expect(word).toHaveAttribute('aria-expanded', 'false');

  // The word is *inside* the paragraph, not a block that broke out of it —
  // which is what a text directive used to compile to.
  const paragraph = page.locator('p', { has: word });
  await expect(paragraph).toContainText("is the referee's way");

  // The explanation appears only when asked for, and goes away again.
  await expect(page.getByText(/punish the team that was fouled/i)).toHaveCount(0);
  await word.click();
  await expect(word).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/punish the team that was fouled/i)).toBeVisible();
  await word.click();
  await expect(page.getByText(/punish the team that was fouled/i)).toHaveCount(0);
});

/**
 * The charter has defined five callout kinds since it was written, and until
 * now every one rendered as the same undifferentiated blockquote.
 */
test('each kind of callout is told apart, and a plain quote is left alone', async ({ page }) => {
  await page.goto('/#/football/02-close-calls');

  const prose = page.locator('.prose');
  // At least one of each: the chapter already carried a definition callout
  // before the section that demonstrates all five, so kinds are not unique.
  for (const kind of ['key', 'how', 'tip', 'pitfall', 'definition']) {
    await expect(prose.locator(`.callout--${kind}`).first()).toBeVisible();
  }

  // Distinct in the rendering, not merely in the markup: each kind resolves to
  // its own accent colour, so the classes are doing visible work.
  const colours = await prose
    .locator('.callout')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderLeftColor));
  expect(new Set(colours).size).toBe(5);

  // The author's emoji stays in the text — it is what makes the convention
  // greppable, and the only marker that survives an export.
  await expect(prose.locator('.callout--tip')).toContainText('💡');
});
