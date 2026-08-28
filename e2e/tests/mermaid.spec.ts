import { test, expect } from '@playwright/test';

/**
 * The mermaid island renders asynchronously: the component is lazy (Mermaid is
 * a large dependency) and the SVG is produced by an async `render` call. So the
 * assertions wait for the drawing, not just the element.
 */
test('a diagram is drawn from its mermaid source', async ({ page }) => {
  await page.goto('/#/guide/02-interactivity-toolkit');

  const diagram = page.locator('.island--mermaid');
  await expect(diagram).toBeVisible();

  // An actual SVG, not the source fallback shown when a diagram fails to parse.
  await expect(diagram.locator('svg')).toBeVisible({ timeout: 30_000 });
  await expect(diagram.getByText('Build step')).toBeVisible();
  await expect(diagram.locator('pre')).toHaveCount(0);
});

test('a diagram redraws when the reader switches theme', async ({ page }) => {
  // Pin the OS preference to light, so "System" is genuinely light and moving
  // to Dark is a real change. Without this the test is a coin flip: on a dark
  // machine, System and Dark resolve identically and nothing should re-render.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/guide/02-interactivity-toolkit');

  const svg = page.locator('.island--mermaid svg').first();
  await expect(svg).toBeVisible({ timeout: 30_000 });
  const before = await svg.getAttribute('id');

  // Mermaid bakes its theme into the rendered SVG, so following the reader's
  // setting means re-rendering — a study guide read at night should not show a
  // white diagram on a dark page. A fresh render id is the evidence.
  const toggle = page.getByRole('button', { name: /Theme:/ });
  for (let i = 0; i < 3; i++) {
    if ((await page.locator('html').getAttribute('data-theme')) === 'dark') break;
    await toggle.click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await expect(page.locator('.island--mermaid svg').first()).not.toHaveAttribute(
    'id',
    before ?? '',
    { timeout: 30_000 },
  );
});
