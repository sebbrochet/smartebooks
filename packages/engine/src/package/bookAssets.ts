/**
 * Turns a Vite glob of a book's `assets/` folder into the same
 * `Record<path, bytes>` shape an imported `.smartbook` package produces, so
 * bundled and imported books share one asset path (Blob URLs at render,
 * included in `.smartbook` export, independent of the site's base path).
 *
 * Two module shapes are accepted, matching the two useful Vite queries:
 *   - `?raw`    — text assets (e.g. SVG) arrive as a plain string.
 *   - `?inline` — binary assets (e.g. audio, images) arrive as a data URL.
 *
 * Keep `?inline` for genuinely small files: inlined bytes are base64 in the
 * bundle, roughly a third larger than the file itself.
 */
export function packBookAssets(modules: Record<string, string>): Record<string, Uint8Array> {
  const encoder = new TextEncoder();
  const assets: Record<string, Uint8Array> = {};

  for (const [path, source] of Object.entries(modules)) {
    const key = path.replace(/^\.\//, '');
    assets[key] = source.startsWith('data:') ? bytesFromDataUrl(source) : encoder.encode(source);
  }

  return assets;
}

function bytesFromDataUrl(url: string): Uint8Array {
  const comma = url.indexOf(',');
  const payload = url.slice(comma + 1);
  if (!url.slice(0, comma).includes(';base64')) {
    return new TextEncoder().encode(decodeURIComponent(payload));
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
