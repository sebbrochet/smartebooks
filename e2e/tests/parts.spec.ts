import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A part's landing page, on a book small enough to reason about: two parts,
 * three chapters, five quiz points between them.
 *
 * Purpose-built rather than reusing the large-book fixture, whose chapters ask
 * the reader nothing — a part page over a book with no quizzes can only be
 * asserted to say "No quiz", which is the least interesting thing it does.
 */

function quiz(id: string, questions: number): string {
  const body = Array.from(
    { length: questions },
    (_, i) => `\n### Question ${i + 1} of ${id}?\n\n- [x] Correct answer\n- [ ] Wrong answer\n`,
  ).join('');
  return `:::quiz{id="${id}"}\n${body}\n:::\n`;
}

function makeBookFile(): string {
  const files: Record<string, Uint8Array> = {
    'smartbook.json': strToU8(
      JSON.stringify({
        schemaVersion: 1,
        slug: 'parted-demo',
        title: 'A Parted Book',
        visibility: 'public',
        parts: [
          { id: 'track-a', title: 'Track A — the tested one' },
          { id: 'track-b', title: 'Track B — the quiet one' },
        ],
        chapters: [
          { file: '01-first.md', order: 1, part: 'track-a' },
          { file: '02-second.md', order: 2, part: 'track-a' },
          { file: '03-third.md', order: 3, part: 'track-b' },
        ],
      }),
    ),
    'content/01-first.md': strToU8(`# First chapter\n\nProse.\n\n${quiz('q-first', 3)}`),
    'content/02-second.md': strToU8(`# Second chapter\n\nProse.\n\n${quiz('q-second', 2)}`),
    'content/03-third.md': strToU8('# Third chapter\n\nNothing is asked here.\n'),
  };

  const path = join(tmpdir(), `smart-ebook-parted-${Date.now()}.smartbook.zip`);
  // Built from `tmpdir()` and a timestamp; no user input reaches it.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(path, zipSync(files));
  return path;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-testid="import-book-input"]').setInputFiles(makeBookFile());
  await page.getByRole('link', { name: 'A Parted Book' }).click();
});

// The sidebar heading for a part carries the same words as the page's own
// title, so every assertion about "the heading" has to say which one.
const partTitle = (page: import('@playwright/test').Page) => page.locator('.part h1');

test('a part page lists its chapters and what they are worth', async ({ page }) => {
  await page.locator('.sidebar__part-link').first().click();

  await expect(partTitle(page)).toHaveText('Track A — the tested one');

  const rows = page.locator('.part__chapters li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('First chapter');

  // Nothing answered yet, so the page reports the stake rather than a score.
  await expect(page.locator('.part__summary')).toContainText('0 of 2 quizzes answered');
  await expect(rows.first()).toContainText('3 points unanswered');
});

test('answering a quiz changes the figures on its part page', async ({ page }) => {
  await page.getByRole('link', { name: 'First chapter' }).click();

  // The radio itself is `opacity: 0` under its label, so the label is the
  // thing a reader clicks and the thing a test must click.
  const questions = page.locator('.island--quiz .quiz__question');
  await questions.nth(0).locator('.quiz__option', { hasText: 'Correct answer' }).click();
  await questions.nth(1).locator('.quiz__option', { hasText: 'Correct answer' }).click();
  await questions.nth(2).locator('.quiz__option', { hasText: 'Wrong answer' }).click();
  await page.getByRole('button', { name: 'Check answers' }).click();

  // Two of three, asserted at the source before the part page is trusted to
  // report it.
  await expect(page.locator('.quiz__result')).toContainText('2 / 3');

  await page.locator('.sidebar__part-link').first().click();

  await expect(page.locator('.part__summary')).toContainText('1 of 2 quizzes answered');
  await expect(page.locator('.part__summary')).toContainText('2/5');
  await expect(page.locator('.part__chapters li').first()).toContainText('2/3 points');
});

test('a part whose chapters ask nothing says so, rather than showing 0/0', async ({ page }) => {
  await page.locator('.sidebar__part-link').nth(1).click();

  await expect(partTitle(page)).toHaveText('Track B — the quiet one');
  await expect(page.locator('.part__summary')).toContainText('1 chapter');
  await expect(page.locator('.part__summary')).not.toContainText('quizzes answered');
  await expect(page.locator('.part__chapters li').first()).toContainText('No quiz');
});

test('the part heading still folds, and the link still navigates', async ({ page }) => {
  const toggle = page.locator('.sidebar__part-toggle').first();
  const list = page.locator('.sidebar__part').first().locator('.sidebar__list');

  // Reading chapter 1 means part A is open; the toggle must still close it
  // rather than having been replaced by the link.
  await expect(list).toBeVisible();
  await toggle.click();
  await expect(list).toBeHidden();

  await page.locator('.sidebar__part-link').first().click();
  await expect(partTitle(page)).toHaveText('Track A — the tested one');
});

/**
 * A part page is a place in a book, not a chapter of it, so it cannot name one
 * — and the resume pointer used to be overwritten with "no chapter" on every
 * view that was not a chapter. Glancing at a contents page would then send the
 * reader back to chapter one next time they opened the site.
 */
test('glancing at a part page does not lose the reader’s chapter', async ({ page }) => {
  // From the sidebar: the chapter's own prev/next links name the same chapter,
  // so an unscoped locator matches two.
  await page.locator('.sidebar').getByRole('link', { name: 'Second chapter' }).click();
  await expect(page.locator('article.prose')).toBeVisible();

  await page.locator('.sidebar__part-link').first().click();
  await expect(partTitle(page)).toHaveText('Track A — the tested one');

  // Back to the bare entry URL, as a returning reader arrives. Not `#/`,
  // which the app deliberately reads as "I want my library".
  await page.goto('/');
  await expect(page).toHaveURL(/02-second/);
});
