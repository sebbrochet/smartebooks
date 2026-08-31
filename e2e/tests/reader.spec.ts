import { test, expect } from '@playwright/test';

// Deep-link straight into the guide's first chapter.
const CHAPTER = '/#/guide/01-getting-started';

test('quiz score persists across a reload', async ({ page }) => {
  await page.goto(CHAPTER);

  // Answer the first (single-choice) question correctly.
  await expect(page.getByText('What does a "token" represent')).toBeVisible();
  await page.getByText('A chunk of text (often a sub-word)').click();

  // Answer the multi-select question correctly.
  await page.getByText('Content is authored in plain Markdown').click();
  await page.getByText('Reader progress is stored locally in the browser').click();
  await page.getByText('Interactivity is added via directives').click();

  await page.getByRole('button', { name: 'Check answers' }).click();
  await expect(page.getByText('Score: 2 / 2')).toBeVisible();

  // Reload — the submitted state and score should be restored from IndexedDB.
  await page.reload();
  await expect(page.getByText('Score: 2 / 2')).toBeVisible();
});

test('checkpoint completion persists across a reload', async ({ page }) => {
  await page.goto(CHAPTER);
  const checkbox = page
    .getByText('I understand what a smart ebook is')
    .locator('..')
    .getByRole('checkbox');
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(
    page.getByText('I understand what a smart ebook is').locator('..').getByRole('checkbox'),
  ).toBeChecked();
});

test('an inline mark stays in its sentence and opens on request', async ({ page }) => {
  await page.goto('/#/guide/02-interactivity-toolkit');

  const word = page.getByRole('button', { name: 'palimpsest' });
  await expect(word).toBeVisible();
  await expect(word).toHaveAttribute('aria-expanded', 'false');

  // The word is *inside* the paragraph, not a block that broke out of it —
  // which is what a text directive used to compile to.
  const paragraph = page.locator('p', { has: word });
  await expect(paragraph).toContainText('is a\ngood name'.replace('\n', ' '));

  // The explanation appears only when asked for, and goes away again.
  await expect(page.getByText(/scraped clean and written on again/i)).toHaveCount(0);
  await word.click();
  await expect(word).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/scraped clean and written on again/i)).toBeVisible();
  await word.click();
  await expect(page.getByText(/scraped clean and written on again/i)).toHaveCount(0);
});
