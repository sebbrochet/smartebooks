import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 2,
  // Cap parallelism: the Stockfish WASM test is memory/CPU heavy, and too many
  // parallel browser contexts starve each other on modest machines.
  workers: 2,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    // Cold Vite startup (plus the predev Stockfish copy) can be slow on modest
    // machines; give it room before Playwright gives up.
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
});
