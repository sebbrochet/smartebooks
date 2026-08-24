// Copies the single-threaded Stockfish build into the app's public/ so it can be
// served as a classic Web Worker (no COOP/COEP headers required). Runs on
// predev/prebuild. The output folder is git-ignored.
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const destDir = join(here, '..', 'public', 'stockfish');

let binDir;
try {
  binDir = join(dirname(require.resolve('stockfish/package.json')), 'bin');
} catch {
  console.warn(
    '[copy-stockfish] stockfish package not found — skipping (analysis will be unavailable).',
  );
  process.exit(0);
}

const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];

mkdirSync(destDir, { recursive: true });
let copied = 0;
for (const file of files) {
  const src = join(binDir, file);
  if (!existsSync(src)) {
    console.warn(`[copy-stockfish] missing ${src}`);
    continue;
  }
  copyFileSync(src, join(destDir, file));
  copied += 1;
}
console.log(`[copy-stockfish] copied ${copied} file(s) → ${destDir}`);
