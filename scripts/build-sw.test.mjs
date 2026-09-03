import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  listBuiltFiles,
  shellFiles,
  readViteManifest,
  versionFor,
  serviceWorkerSource,
  buildServiceWorker,
} from './build-sw.mjs';

/** A built site, as Vite would leave one. */
function fakeDist(files) {
  const dir = mkdtempSync(join(tmpdir(), 'sw-'));
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

/**
 * The shape Vite emits: an entry, a chunk it imports statically, a chunk it
 * imports dynamically (an island pack), and an asset only that pack references.
 */
const MANIFEST = {
  'index.html': {
    isEntry: true,
    file: 'assets/index-aaa.js',
    css: ['assets/index-aaa.css'],
    imports: ['_vendor-bbb.js'],
    dynamicImports: ['src/packs/chess.ts'],
  },
  '_vendor-bbb.js': { file: 'assets/vendor-bbb.js' },
  'src/packs/chess.ts': { file: 'assets/chess-ccc.js', css: ['assets/chess-ccc.css'] },
};

const SITE = {
  'index.html': '<!doctype html>',
  'assets/index-aaa.js': 'entry',
  'assets/index-aaa.css': 'body{}',
  'assets/vendor-bbb.js': 'vendor',
  'assets/chess-ccc.js': 'chess',
  'assets/chess-ccc.css': '.board{}',
  'assets/index-aaa.js.map': '{"version":3}',
  'stockfish/engine.wasm': 'several megabytes, pretend',
  '.vite/manifest.json': JSON.stringify(MANIFEST),
};

test('lists every emitted file, with forward slashes and no source maps', () => {
  const dir = fakeDist(SITE);
  try {
    const files = listBuiltFiles(dir);

    assert.ok(files.includes('index.html'));
    assert.ok(files.includes('stockfish/engine.wasm'));
    // A source map is for whoever debugs the site, and is often larger than the
    // code it describes.
    assert.ok(!files.some((file) => file.endsWith('.map')));
    assert.ok(files.every((file) => !file.includes('\\')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('never precaches the worker or the manifest', () => {
  const dir = fakeDist({ ...SITE, 'sw.js': 'old', 'manifest.webmanifest': '{}' });
  try {
    const files = listBuiltFiles(dir);
    // A worker that caches itself can never be replaced: the browser would be
    // served the old one forever, and the reader could not leave a broken
    // version behind.
    assert.ok(!files.includes('sw.js'));
    assert.ok(!files.includes('manifest.webmanifest'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the shell is the entry and what it imports statically', () => {
  assert.deepEqual(shellFiles(MANIFEST), [
    'assets/index-aaa.css',
    'assets/index-aaa.js',
    'assets/vendor-bbb.js',
    'index.html',
  ]);
});

/**
 * The measurement that produced this rule: precaching all 95 emitted files came
 * to 11.4 MB, pulling the Stockfish engine and every font subset onto the wire
 * for a reader who opens neither. `main.tsx` had deliberately arranged for an
 * English reader to fetch one 47 kB font file and no more.
 */
test('leaves lazily-loaded packs and their assets for the reader who opens them', () => {
  const files = shellFiles(MANIFEST);

  assert.ok(!files.includes('assets/chess-ccc.js'));
  assert.ok(!files.includes('assets/chess-ccc.css'));
  assert.ok(!files.some((file) => file.endsWith('.wasm')));
});

test('survives a manifest that names a chunk it does not describe', () => {
  const broken = { 'index.html': { isEntry: true, file: 'a.js', imports: ['missing.js'] } };
  assert.deepEqual(shellFiles(broken), ['a.js', 'index.html']);
});

test('does not loop on a chunk cycle', () => {
  const cyclic = {
    'index.html': { isEntry: true, file: 'a.js', imports: ['b'] },
    b: { file: 'b.js', imports: ['index.html'] },
  };
  assert.deepEqual(shellFiles(cyclic), ['a.js', 'b.js', 'index.html']);
});

test('reads the manifest Vite writes, and reports its absence rather than throwing', () => {
  const dir = fakeDist(SITE);
  try {
    assert.ok(readViteManifest(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const bare = fakeDist({ 'index.html': '<!doctype html>' });
  try {
    assert.equal(readViteManifest(bare), undefined);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test('falls back to the shell alone when there is no manifest', () => {
  const dir = fakeDist({ 'index.html': '<!doctype html>', 'assets/app.js': 'x' });
  try {
    const { files } = buildServiceWorker(dir, '/');
    // Not everything in `dist`: guessing is the failure this fallback avoids.
    assert.deepEqual(files, ['index.html']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the version follows the content, not the clock', () => {
  const digests = { a: '1', b: '2' };
  const first = versionFor(['a', 'b'], (file) => digests[file]);
  const again = versionFor(['a', 'b'], (file) => digests[file]);

  // Rebuilding unchanged sources must not invalidate every reader's cache and
  // re-download the site to say nothing.
  assert.equal(first, again);

  const changed = versionFor(['a', 'b'], (file) => (file === 'b' ? '3' : digests[file]));
  assert.notEqual(first, changed);
});

test('a renamed file changes the version even when the bytes are identical', () => {
  assert.notEqual(
    versionFor(['app-abc.js'], () => 'same'),
    versionFor(['app-def.js'], () => 'same'),
  );
});

test('never calls skipWaiting except when the reader asks', () => {
  const source = serviceWorkerSource({ version: 'v1', files: ['index.html'], base: '/' });

  // The whole of E2.1's update rule, in one assertion: the only `skipWaiting`
  // in the file is the one behind the reader's message. A worker that
  // activates itself swaps the shell under someone who is reading.
  assert.equal((source.match(/skipWaiting/g) ?? []).length, 1);
  assert.match(source, /if \(event\.data === 'SKIP_WAITING'\) self\.skipWaiting\(\);/);
});

/**
 * The failure this prevents was blank pages, and it was invisible in every unit
 * test: the files were in the cache, the offline request asked for one of them
 * by exactly the right URL, and it missed.
 *
 * A precached response is stored against a request with no `Origin` header;
 * `<script crossorigin>` sends one; the server answers `Vary: Origin`. Safe to
 * ignore only because every precached name is content-hashed.
 */
test('ignores Vary when looking a file up, or the precache silently misses', () => {
  const source = serviceWorkerSource({ version: 'v1', files: ['index.html'], base: '/' });

  const lookups = source.match(/caches\.match\([^)]*\)/g) ?? [];
  assert.ok(lookups.length > 0);
  for (const lookup of lookups) assert.match(lookup, /MATCH/);
  assert.match(source, /const MATCH = \{ ignoreVary: true \};/);
});

test('scopes precached URLs to the base path a project page is served from', () => {
  const source = serviceWorkerSource({
    version: 'v1',
    files: ['index.html', 'assets/app.js'],
    base: '/smart-ebook/',
  });

  assert.match(source, /"\/smart-ebook\/index\.html"/);
  assert.match(source, /"\/smart-ebook\/assets\/app\.js"/);
});

test('tolerates a base path given without its trailing slash', () => {
  const source = serviceWorkerSource({ version: 'v1', files: ['index.html'], base: '/repo' });
  assert.match(source, /"\/repo\/index\.html"/);
  assert.doesNotMatch(source, /"\/repoindex\.html"/);
});

test('writes a worker listing the shell, and only the shell', () => {
  const dir = fakeDist(SITE);
  try {
    const { files, version } = buildServiceWorker(dir, '/');
    const written = readFileSync(join(dir, 'sw.js'), 'utf8');

    assert.ok(version.length > 0);
    for (const file of files) assert.ok(written.includes(`"/${file}"`), `missing ${file}`);
    assert.ok(!written.includes('chess-ccc.js'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a second build over its own output stays stable', () => {
  const dir = fakeDist(SITE);
  try {
    const first = buildServiceWorker(dir, '/');
    // `sw.js` now exists in `dist`. If it were precached, or counted in the
    // version, every build would differ from the last one for no reason.
    const second = buildServiceWorker(dir, '/');
    assert.equal(first.version, second.version);
    assert.deepEqual(first.files, second.files);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
