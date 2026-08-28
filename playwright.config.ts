import { defineConfig } from '@playwright/test';

// Windows can reserve port ranges for Hyper-V/WSL (`netsh interface ipv4 show
// excludedportrange`), which makes the default unbindable with EACCES on some
// machines. Allow an override rather than requiring a config edit.
const port = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 2,
  // Cap parallelism: the Stockfish WASM test is memory/CPU heavy, and too many
  // parallel browser contexts starve each other on modest machines.
  workers: 2,
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    // Run the workspace's own dev script so `predev` (the Stockfish copy) still
    // happens. The extra `--` forwards the port through npm to Vite.
    command: `npm run dev --workspace @smart-ebooks/library -- --port ${port} --strictPort`,
    port,
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
