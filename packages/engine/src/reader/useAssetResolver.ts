import { useEffect, useMemo, useState } from 'react';

export type AssetResolver = (src: string) => string | undefined;

function mimeForPath(path: string): string {
  switch (path.split('.').pop()?.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'pgn':
      return 'application/x-chess-pgn';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Turn a book's packaged asset bytes into a resolver from `assets/…` paths to
 * Blob URLs.
 *
 * The URLs are created **in the effect that revokes them**, not in a memo.
 * That looks like a detail and is not: under `StrictMode` React mounts, unmounts
 * and remounts, so a memo-created map is revoked by the first unmount and never
 * rebuilt — every URL is dead by the time anything asks for it. Creating and
 * revoking in the same effect makes the pair symmetric. Found 2026-08-31, when
 * a `fetch` of a packaged file failed with `ERR_FILE_NOT_FOUND`; an `<img>` had
 * been failing the same way, silently.
 */
export function useAssetResolver(assets?: Record<string, Uint8Array>): AssetResolver | undefined {
  const [urls, setUrls] = useState<Map<string, string>>();

  useEffect(() => {
    if (!assets || Object.keys(assets).length === 0) {
      setUrls(undefined);
      return;
    }

    const map = new Map<string, string>();
    for (const [path, bytes] of Object.entries(assets)) {
      const blob = new Blob([bytes], { type: mimeForPath(path) });
      map.set(path, URL.createObjectURL(blob));
    }
    setUrls(map);

    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assets]);

  return useMemo(() => {
    if (!urls) return undefined;
    return (src: string) => urls.get(src.replace(/^\.\//, ''));
  }, [urls]);
}
