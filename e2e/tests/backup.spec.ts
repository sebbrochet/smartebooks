import { test, expect } from '@playwright/test';

const CHAPTER = '/#/guide/01-getting-started';
const CHECKPOINT = 'I understand what a smart ebook is';

function checkpoint(page: import('@playwright/test').Page) {
  return page.getByText(CHECKPOINT).locator('..').getByRole('checkbox');
}

test('progress export then import restores state after a reset', async ({ page }) => {
  await page.goto(CHAPTER);
  await checkpoint(page).check();
  await expect(checkpoint(page)).toBeChecked();

  // Export the backup file.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export progress' }).click(),
  ]);
  const file = await download.path();

  // Reset wipes this book's progress (and reloads).
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(checkpoint(page)).not.toBeChecked();

  // Import the backup via the hidden file input; the app reloads on success.
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(checkpoint(page)).toBeChecked();
});

test('a book can be exported as a .smartbook package', async ({ page }) => {
  await page.goto(CHAPTER);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export book' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('guide.smartbook.zip');
});
