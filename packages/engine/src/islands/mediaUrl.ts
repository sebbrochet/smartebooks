/**
 * For untrusted (imported) books, media sources are restricted to https to
 * avoid `javascript:`, `data:`, or other unsafe schemes. Trusted (bundled)
 * books are authored by you and are not restricted here.
 */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
