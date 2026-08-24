import { useEffect, useState } from 'react';

export type AppRoute =
  | { view: 'shelf' }
  | { view: 'book'; bookSlug: string; chapterSlug?: string }
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
  return { view: 'book', bookSlug, chapterSlug: segments[1] };
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
