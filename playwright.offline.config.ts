import { defineConfig } from '@playwright/test';

/**
 * The offline suite, which has to run against a **built** site.
 *
 * Separate from `playwright.config.ts` for two reasons that are not
 * negotiable. The service worker is deliberately not registered in development
 * — a worker serving a cached shell is precisely what a dev server must not do
 * — so the ordinary suite could never exercise it. And a build takes minutes,
 * which is not a cost the everyday gate should carry.
 *
 * Run with `npm run test:e2e:offline`, which builds first.
 */
/**
 * 5401, not 5410. Windows reserves port ranges for Hyper-V/WSL, and on this
 * machine `netsh interface ipv4 show excludedportrange protocol=tcp` reports
 * **5408–5507** — so the first choice failed to bind with EACCES and the only
 * symptom was Playwright timing out on the web server 120 seconds later.
 * Override with `E2E_OFFLINE_PORT` if this range differs elsewhere.
 */
const port = Number(process.env.E2E_OFFLINE_PORT ?? 5401);

export default defineConfig({
  testDir: './e2e/offline',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run preview --workspace @smart-ebooks/library -- --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
});
