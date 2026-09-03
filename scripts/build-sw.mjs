/**
 * Generates the service worker that makes the reader work offline (SPEC003
 * E2.1, closing D8).
 *
 * **Hand-written rather than Workbox**, for the same reason the search index
 * and the theme system are: the whole of it fits on a screen and every rule in
 * it is one this project has an opinion about. A precache list plus two fetch
 * strategies is not where a build-time dependency earns its place, and the
 * update behaviour E2.1 demands is the one thing a generic plugin gets wrong by
 * default.
 *
 * Run after the site is built (`postbuild`), because the file names Vite emits
 * are content-hashed and are only known then.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, posix, relative, sep } from 'node:path';

/**
 * Files worth holding for a reader with no network.
 *
 * Source maps and the service worker itself are excluded: the first is for
 * whoever debugs the site and is often larger than the code it describes, and
 * the second must always be fetched fresh or the reader could never leave a
 * broken version behind.
 */
const SKIP = /(\.map$|^sw\.js$|^manifest\.webmanifest$)/;

/** Every emitted file, as base-relative URLs with forward slashes. */
export function listBuiltFiles(dir, root = dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = join(dir, entry);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (statSync(full).isDirectory()) return listBuiltFiles(full, root);
      return [relative(root, full).split(sep).join(posix.sep)];
    })
    .filter((file) => !SKIP.test(file))
    .sort();
}

/**
 * What the reader needs before the app can render at all: the shell, the entry
 * chunk, and the chunks and stylesheets it imports *statically*.
 *
 * **Not everything in `dist`.** The first draft precached all 95 emitted files,
 * 11.4 MB, which would have downloaded the Stockfish engine and every font
 * subset to a reader who opens neither — undoing the arrangement `main.tsx`
 * describes, where an English reader fetches one 47 kB font file and the other
 * subsets cost disk in `dist` and nothing on the wire.
 *
 * Dynamic imports are deliberately left out. They are the island packs and the
 * per-book chunks, and they are exactly the things a reader should pay for when
 * they open the book that needs them. The fetch handler caches them as they are
 * used, which is what makes "books the reader has opened" work offline
 * (SPEC003 E2.1) without making it work for books they have not.
 */
export function shellFiles(manifest) {
  const seen = new Set();

  const walk = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    for (const next of chunk.imports ?? []) walk(next);
  };

  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isEntry) walk(key);
  }

  const files = new Set(['index.html']);
  for (const key of seen) {
    const chunk = manifest[key];
    if (!chunk) continue;
    if (chunk.file) files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
  }

  return [...files].filter((file) => !SKIP.test(file)).sort();
}

/** Reads Vite's build manifest, or returns undefined if the build did not emit one. */
export function readViteManifest(dist) {
  const path = join(dist, '.vite', 'manifest.json');
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * A version derived from the bytes being cached.
 *
 * Not a timestamp: rebuilding unchanged sources would then invalidate every
 * reader's cache and re-download the site to say nothing. Content-derived means
 * a rebuild that changes nothing *is* nothing.
 */
export function versionFor(files, digestOf) {
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file}\u0000${digestOf(file)}\u0000`);
  return hash.digest('hex').slice(0, 16);
}

/**
 * The service worker source.
 *
 * Two strategies, because the shell and its assets have opposite needs:
 *
 * - **Hashed assets are cache-first.** Their name changes when their content
 *   does, so a cached copy is never stale and going to the network for one is
 *   pure latency.
 * - **Navigations are cache-first *on the shell*.** This is a hash-routed SPA
 *   with no server-rendered routes, so every navigation is the same
 *   `index.html`. Serving it from the cache is what makes an offline reload
 *   work at all.
 *
 * Anything else same-origin falls back to the network and is cached as it goes,
 * which covers files a build emits but never precaches.
 *
 * **`skipWaiting` is deliberately absent.** A worker that activates itself
 * swaps the shell under someone who is reading, and the reader's next
 * navigation is a different application than the one they opened. The page asks
 * instead, and only sends `SKIP_WAITING` when the reader says so (E2.1).
 */
export function serviceWorkerSource({ version, files, base }) {
  const scope = base.endsWith('/') ? base : `${base}/`;

  return `/* Generated by scripts/build-sw.mjs. Do not edit. */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'smart-ebooks-' + VERSION;
const BASE = ${JSON.stringify(scope)};
const PRECACHE = ${JSON.stringify(
    [...files].map((file) => scope + file),
    null,
    2,
  )};
const SHELL = BASE + 'index.html';

/*
 * \`ignoreVary\`, and it is not optional.
 *
 * A precached response is stored against the request \`cache.addAll\` made,
 * which carries no \`Origin\` header. The page then asks for the same file with
 * \`<script crossorigin>\`, which does. Vite's preview server — and plenty of
 * static hosts — answer with \`Vary: Origin\`, so the two requests do not match
 * and the lookup misses a file that is definitely in the cache.
 *
 * Measured, not guessed: the entry chunk was cached, the offline reload asked
 * for that exact URL, and it failed with ERR_FAILED and a blank page.
 *
 * Ignoring \`Vary\` is safe here in a way it would not generally be, because
 * every precached name is content-hashed: the URL alone determines the bytes.
 */
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Every other version's cache, including ones from a build this worker
      // has never heard of. Leaving them costs the reader's disk quota.
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('smart-ebooks-') && name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  // The only way this worker ever takes over early: the reader asked.
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(SHELL, MATCH);
        if (cached) return cached;
        return fetch(request);
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, MATCH);
      if (cached) return cached;

      const response = await fetch(request);
      // Opaque and error responses are not worth keeping: a cached 404 outlives
      // the outage that caused it.
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
`;
}

/** Writes `sw.js` into a built site. Returns what it cached, for the caller to report. */
export function buildServiceWorker(dist, base = '/') {
  const manifest = readViteManifest(dist);
  // Without a manifest, fall back to the shell alone rather than to everything:
  // a reader who has visited once still gets an offline reload, because the
  // fetch handler caches what they actually used. Precaching the whole of
  // `dist` on a guess is the failure this fallback exists to avoid.
  const files = manifest ? shellFiles(manifest) : ['index.html'];

  const version = versionFor(files, (file) =>
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    createHash('sha256')
      .update(readFileSync(join(dist, file)))
      .digest('hex'),
  );

  const source = serviceWorkerSource({ version, files, base });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(join(dist, 'sw.js'), source);
  return { files, version };
}

// Only when run directly. The exports above are imported by `build-sw.test.mjs`,
// which must not trigger a build of anything.
if (process.argv[1] && process.argv[1].endsWith('build-sw.mjs')) {
  const dist = process.argv[2] ?? 'apps/library/dist';
  const base = process.env.BASE_PATH ?? '/';

  try {
    const { files, version } = buildServiceWorker(dist, base);
    const kb = (
      files.reduce(
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        (total, file) => total + statSync(join(dist, file)).size,
        0,
      ) / 1024
    ).toFixed(0);
    console.log(`sw.js  ${files.length} files precached, ${kb} kB  [${version}]`);
  } catch (error) {
    console.error(`build-sw: ${error.message}`);
    process.exit(1);
  }
}
