import { createContext, useContext, useMemo, type ReactNode } from 'react';
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
  /**
   * The unit this island is rendered in, when the book's files carry units
   * (SPEC005 M2). Undefined when the file is the page, which is every book
   * that does not declare a `unitDepth`.
   *
   * SPEC001 L17 / SPEC011 B9: an island could see nothing of where it was, so
   * a pack could not tell a section the reader is *on* from one they are
   * re-reading. The engine answers only "which unit", because "is it the live
   * one" is a question about the reader's history and belongs to whoever keeps
   * it — for a gamebook, the journey.
   */
  unit?: string;
  /**
   * A link to another unit of the chapter being read.
   *
   * Supplied so that an island can point at a sibling unit without knowing the
   * router: the app is hash-routed and a bare fragment would replace the whole
   * route (SPEC002 R1.3). A gamebook's `::choice` is the reason this exists,
   * and it must render a real link rather than a click handler.
   */
  linkTo?: (unit: string) => string;
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

/**
 * Names the unit its children are rendered in, keeping everything else the
 * surrounding {@link BookProvider} already said.
 *
 * A second provider rather than a prop on the first, because only the view that
 * resolves the unit knows which one it settled on — `?s=` may name a unit the
 * book does not have — and it sits well below the book.
 */
export function UnitProvider({
  unit,
  linkTo,
  children,
}: {
  unit?: string;
  linkTo?: (unit: string) => string;
  children: ReactNode;
}) {
  const book = useBook();
  const value = useMemo(() => ({ ...book, unit, linkTo }), [book, unit, linkTo]);

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}
