/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    // The suite spends ~0.3s actually running tests; the rest is worker startup.
    // Spawning one worker per file bought nothing and failed intermittently on
    // constrained machines, so share a single worker: faster and reliable.
    fileParallelism: false,
    // Guards a slow *test*, not a slow worker. Worth being explicit, because
    // this line used to claim it stopped "a cold run failing spuriously" and it
    // cannot: the pool gives a worker 60s to report for duty
    // (`START_TIMEOUT = 6e4`, hardcoded in vitest's pool — no config reaches
    // it), and on a loaded machine one file in ~39 misses that window and is
    // reported as "Failed to start threads worker", never as a test failure.
    // Observed on 4 consecutive runs 2026-09-01, a different file each time,
    // under both `threads` and `forks`. Only lower machine load helps; the
    // real cost is jsdom, which is ~60% of the wall clock and which most of
    // these files do not need.
    testTimeout: 30000,
    // Node-side scripts (the content linter) are tested with `node --test`
    // instead — they need no DOM, and running them under jsdom workers is
    // needless machinery. See `npm run test:scripts`.
    include: ['packages/**/src/**/*.{test,spec}.{ts,tsx}', 'apps/**/src/**/*.{test,spec}.{ts,tsx}'],
    // ...with one exception: `exportParity.test.ts` imports those scripts to
    // check the CLI packager and the browser exporter still agree. They must be
    // loaded by Node, not transformed by Vite, because they derive the repo
    // root from `import.meta.url` — which is no longer a `file:` URL once Vite
    // has rewritten it.
    server: { deps: { external: [/[\\/]scripts[\\/].*\.mjs$/] } },
  },
});
