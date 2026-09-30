import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A GitHub *project* page is served from `/<repo>/`, so the base path has to be
// configurable. CI sets BASE_PATH; local dev and user/org pages stay at the root.
// Everything that builds a URL at runtime reads `import.meta.env.BASE_URL`, so
// it follows automatically.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  build: {
    // Emitted so `scripts/build-sw.mjs` can precache the entry chunk and its
    // *static* imports exactly, rather than guessing from file names. The
    // difference is not cosmetic: precaching everything in `dist` would pull
    // every lazy pack and font subset onto the wire for a reader who opens
    // none of them, which is the opposite of what `main.tsx` deliberately
    // arranged.
    manifest: true,
  },
  server: {
    host: true,
  },
});
