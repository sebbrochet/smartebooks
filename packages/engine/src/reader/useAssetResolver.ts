import { useEffect, useMemo } from 'react';

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
 * Blob URLs. Object URLs are created once per asset set and revoked on change or
 * unmount so nothing leaks.
 */
export function useAssetResolver(assets?: Record<string, Uint8Array>): AssetResolver | undefined {
  const urls = useMemo(() => {
    if (!assets || Object.keys(assets).length === 0) return undefined;
    const map = new Map<string, string>();
    for (const [path, bytes] of Object.entries(assets)) {
      const blob = new Blob([bytes], { type: mimeForPath(path) });
      map.set(path, URL.createObjectURL(blob));
    }
    return map;
  }, [assets]);

  useEffect(() => {
    return () => {
      urls?.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  return useMemo(() => {
    if (!urls) return undefined;
    return (src: string) => urls.get(src.replace(/^\.\//, ''));
  }, [urls]);
}
