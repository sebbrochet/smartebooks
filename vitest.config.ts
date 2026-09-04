/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    /*
     * **Node by default; jsdom is opted into per file.**
     *
     * Six of ~42 test files touch a DOM. Building a jsdom for the other
     * thirty-six was most of the suite's wall clock — the run this changed
     * reported 223s of `environment` against 2.2s of `tests` — and that cost
     * was not only slow, it was the direct cause of a recurring failure: the
     * pool gives each worker 60s to report for duty (`START_TIMEOUT = 6e4`,
     * hardcoded, no config reaches it), and on a loaded machine one file per
     * run missed the window and was reported as "Failed to start threads
     * worker". Three consecutive runs, a different file each time.
     *
     * A file that needs a document says so in its own docblock:
     *
     *     // @vitest-environment jsdom
     *
     * which is also documentation: it marks the tests that depend on a browser
     * rather than leaving every file to imply it might.
     */
    environment: 'node',
    globals: true,
    // Turns React's "update was not wrapped in act(...)" diagnostic on for
    // every file rather than one — see vitest.setup.ts.
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    // The suite spends ~2s actually running tests; the rest is worker startup.
    // Spawning one worker per file bought nothing and failed intermittently on
    // constrained machines, so share a single worker: faster and reliable.
    fileParallelism: false,
    // Guards a slow *test*, not a slow worker. Worth being explicit, because
    // this line once claimed it stopped "a cold run failing spuriously" and it
    // cannot — see the note above for what actually governs worker startup.
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
