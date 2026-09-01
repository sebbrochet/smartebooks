import { useEffect, useState } from 'react';

export type AppRoute =
  | { view: 'shelf' }
  | { view: 'book'; bookSlug: string; chapterSlug?: string; heading?: string }
  | { view: 'search'; bookSlug: string; query: string };

export function parseAppHash(hash: string): AppRoute {
  const raw = hash.replace(/^#/, '');
  const [path, queryString] = raw.split('?');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return { view: 'shelf' };

  const bookSlug = segments[0];
  if (segments[1] === 'search') {
    const query = new URLSearchParams(queryString ?? '').get('q') ?? '';
    return { view: 'search', bookSlug, query };
  }

  // A section within a chapter is `?s=`, not a second `#`: the route already
  // lives in the hash, so a fragment cannot be nested inside it. Using the
  // query the search view already established keeps one grammar rather than
  // inventing a second (SPEC002 S3).
  //
  // `s` for section, deliberately **not** `h`. MkDocs Material — the reference
  // this reader is being measured against — spends `?h=` on *highlight terms*
  // for search results. Reserving it keeps that meaning available if in-page
  // highlighting is ever built, instead of two features fighting over one
  // parameter (SPEC002 N14).
  const heading = new URLSearchParams(queryString ?? '').get('s') ?? undefined;
  return { view: 'book', bookSlug, chapterSlug: segments[1], heading };
}

/** Reactive, hash-based platform route across books. No router dependency. */
export function useAppRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() => parseAppHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseAppHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
