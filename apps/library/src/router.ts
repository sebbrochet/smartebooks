import { useEffect, useState } from 'react';

export type AppRoute =
  | { view: 'shelf' }
  | {
      view: 'book';
      bookSlug: string;
      chapterSlug?: string;
      heading?: string;
      highlight?: string[];
    }
  | { view: 'part'; bookSlug: string; partId: string }
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

  // `#/<book>/part/<id>`, matching the `search` shape above. It costs the
  // chapter slugs `search` and `part`, which is the same trade the search
  // route already made; a book that needs them can rename the file, and
  // nothing silently misroutes because a two-segment path is still a chapter.
  if (segments[1] === 'part' && segments[2]) {
    return { view: 'part', bookSlug, partId: segments[2] };
  }

  // A section within a chapter is `?s=`, not a second `#`: the route already
  // lives in the hash, so a fragment cannot be nested inside it. Using the
  // query the search view already established keeps one grammar rather than
  // inventing a second (SPEC002 S3).
  //
  // `s` for section and `h` for the terms to mark — the same split MkDocs
  // Material uses, which is why `h` was kept free when sections shipped.
  const params = new URLSearchParams(queryString ?? '');
  const heading = params.get('s') ?? undefined;
  const terms = (params.get('h') ?? '').split(/\s+/).filter(Boolean);

  return {
    view: 'book',
    bookSlug,
    chapterSlug: segments[1],
    heading,
    highlight: terms.length ? terms : undefined,
  };
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
