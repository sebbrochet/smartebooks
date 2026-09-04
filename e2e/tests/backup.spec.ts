import { test, expect } from '@playwright/test';

const CHAPTER = '/#/guide/01-getting-started';
const CHECKPOINT = 'I understand what a smart ebook is';

function checkpoint(page: import('@playwright/test').Page) {
  return page.getByText(CHECKPOINT).locator('..').getByRole('checkbox');
}

/**
 * The confirm button restates the action, so it carries the same name as the
 * control that opened it. Scoped to the dialog rather than renamed: "Reset
 * progress" is what the reader is agreeing to, and a vaguer word on the button
 * that does the damage would be worse than an ambiguous locator.
 */
function confirmReset(page: import('@playwright/test').Page) {
  return page.getByRole('alertdialog').getByRole('button', { name: 'Reset progress' });
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

  // Reset wipes this book's progress (and reloads) — once confirmed.
  await page.locator('.reader__tools').getByRole('button', { name: 'Reset progress' }).click();
  await confirmReset(page).click();
  await expect(checkpoint(page)).not.toBeChecked();

  // Import the backup via the hidden file input; the app reloads on success.
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(checkpoint(page)).toBeChecked();
});

/**
 * Reset is the only control in the app that destroys something with no way
 * back: a deleted import returns with its progress if the reader still has the
 * file, and these scores do not.
 */
test('resetting progress asks first, and cancelling keeps everything', async ({ page }) => {
  await page.goto(CHAPTER);
  await checkpoint(page).check();
  await expect(checkpoint(page)).toBeChecked();

  await page.locator('.reader__tools').getByRole('button', { name: 'Reset progress' }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  // Named, so a reader with several books knows which one they are clearing.
  await expect(dialog).toContainText('The Smart Ebook Guide');
  // And told the one thing that would have made this reversible.
  await expect(dialog).toContainText('Export progress');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(checkpoint(page)).toBeChecked();

  // Escape is a second way out, and must not destroy anything either.
  await page.locator('.reader__tools').getByRole('button', { name: 'Reset progress' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
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
