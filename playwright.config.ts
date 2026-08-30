import { defineConfig } from '@playwright/test';

// Windows can reserve port ranges for Hyper-V/WSL (`netsh interface ipv4 show
// excludedportrange`), which makes the default unbindable with EACCES on some
// machines. Allow an override rather than requiring a config edit.
const port = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 2,
  // Run serially. The comment here used to say "cap at 2, because the Stockfish
  // WASM test is heavy" — the suite has since grown a second Stockfish test and
  // two Mermaid ones, and two parallel contexts starve each other badly enough
  // that *unrelated* tests fail with "element not found" through their retries.
  // Measured on one moderately loaded machine: 2 workers took 2.3m and failed
  // three tests; 1 worker took 1.0m and passed. Parallelism was buying nothing,
  // because the contention it created cost more than it saved.
  //
  // This makes the suite more robust, not reliable: on a busy machine it still
  // fails intermittently, and individual specs that pass alone can take an
  // order of magnitude longer than usual. Treat a lone failure as suspect and
  // re-run the spec on its own before believing it.
  workers: 1,
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
