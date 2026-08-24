import { createContext, useContext, type ReactNode } from 'react';
import { createIslandRegistry, type IslandRegistry } from '../islandRegistry';

type AssetResolver = (src: string) => string | undefined;

interface BookContextValue {
  /** Stable book slug used to namespace all local persistence for this book. */
  slug: string;
  /** Whether the book's content is trusted. Imported books are untrusted. */
  trusted: boolean;
  /** Resolve in-package `assets/…` references (Blob URLs for imported books). */
  resolveAsset?: AssetResolver;
  /** Island lookup scoped to this book. */
  registry: IslandRegistry;
}

const emptyRegistry = createIslandRegistry([]);

const BookContext = createContext<BookContextValue>({
  slug: '_default',
  trusted: true,
  registry: emptyRegistry,
});

export function useBook(): BookContextValue {
  return useContext(BookContext);
}

export function BookProvider({
  slug,
  trusted = true,
  resolveAsset,
  registry,
  children,
}: {
  slug: string;
  trusted?: boolean;
  resolveAsset?: AssetResolver;
  registry: IslandRegistry;
  children: ReactNode;
}) {
  return (
    <BookContext.Provider value={{ slug, trusted, resolveAsset, registry }}>
      {children}
    </BookContext.Provider>
  );
}
