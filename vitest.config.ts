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
    // Worker startup can still be slow on constrained machines; keep a generous
    // timeout so a cold run doesn't fail spuriously. The suite itself is tiny.
    testTimeout: 30000,
    // Node-side scripts (the content linter) are tested with `node --test`
    // instead — they need no DOM, and running them under jsdom workers is
    // needless machinery. See `npm run test:scripts`.
    include: ['packages/**/src/**/*.{test,spec}.{ts,tsx}', 'apps/**/src/**/*.{test,spec}.{ts,tsx}'],
  },
});
