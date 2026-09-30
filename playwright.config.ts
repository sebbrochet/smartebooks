import { defineConfig } from '@playwright/test';

// Windows can reserve port ranges for Hyper-V/WSL (`netsh interface ipv4 show
// excludedportrange`), which makes the default unbindable with EACCES on some
// machines. Allow an override rather than requiring a config edit.
const port = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 2,
  // Run serially — but the reason is now weaker than it was, and the old
  // measurement no longer reproduces.
  //
  // It once read: 2 workers took 2.3m and failed three tests, 1 worker took
  // 1.0m and passed, so parallelism bought nothing. That was measured with a
  // 7 MB WASM chess engine in the suite, which no longer ships. Re-measured
  // 2026-09-30 on one loaded laptop, same commit, one sample each:
  // **1 worker 6.9m, 139 passed + 3 flaky; 2 workers 5.4m, 140 passed +
  // 2 flaky. Neither run failed a test.**
  //
  // So the claim that parallelism costs more than it saves is no longer
  // supported. It stays at 1 anyway, because both measurements were taken on a
  // developer machine under load and CI runs on a dedicated runner — flipping a
  // CI setting on a laptop sample is exactly how the superseded comment above
  // came to be wrong. Raising it wants a measurement from CI itself.
  //
  // Serial makes the suite more robust, not reliable: on a busy machine it
  // still fails intermittently, and individual specs that pass alone can take
  // an order of magnitude longer than usual. Treat a lone failure as suspect
  // and re-run the spec on its own before believing it.
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    // Run the workspace's own dev script rather than vite directly, so any
    // pre-step it grows happens here too. The extra `--` forwards the port
    // through npm to Vite.
    command: `npm run dev --workspace @smart-ebooks/library -- --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    // Cold Vite startup can be slow on modest machines; give it room before
    // Playwright gives up.
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
});
