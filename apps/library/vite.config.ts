import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A GitHub *project* page is served from `/<repo>/`, so the base path has to be
// configurable. CI sets BASE_PATH; local dev and user/org pages stay at the root.
// Everything that builds a URL at runtime (e.g. the Stockfish worker) reads
// `import.meta.env.BASE_URL`, so it follows automatically.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  server: {
    host: true,
  },
});
