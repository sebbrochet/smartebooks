/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    // Worker startup can be slow on constrained machines; keep a generous
    // timeout so a cold run doesn't fail spuriously. The suite itself is tiny.
    testTimeout: 30000,
    include: ['packages/**/src/**/*.{test,spec}.{ts,tsx}', 'apps/**/src/**/*.{test,spec}.{ts,tsx}'],
  },
});
