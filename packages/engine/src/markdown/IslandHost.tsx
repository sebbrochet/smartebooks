import { Suspense, useMemo, type ReactNode } from 'react';
import { useBook } from '../reader/BookContext';
import { useMessages } from '../i18n/messages';
import { IslandBoundary } from './IslandBoundary';
import type { AttributeValue } from '../islands/attributes';

interface IslandHostProps {
  type?: string;
  /** The island's persistence key. Named to survive sanitising — see `remarkIslands`. */
  islandId?: string;
  config?: string;
  children?: ReactNode;
}

interface ParsedConfig {
  attributes?: Record<string, AttributeValue>;
  data?: unknown;
}

function safeParse(config: string | undefined): ParsedConfig {
  if (!config) return {};
  try {
    return JSON.parse(config) as ParsedConfig;
  } catch {
    return {};
  }
}

/**
 * Maps a neutral `<island type=… islandId=… config=…>` element (produced by
 * remarkIslands) to one of the islands the book declares. Directives outside the
 * book's registry render a visible placeholder; components may be lazy (wrapped
 * in Suspense).
 */
export function IslandHost({ type, islandId, config, children }: IslandHostProps) {
  const { trusted, registry, resolveAsset } = useBook();
  const definition = type ? registry.get(type) : undefined;
  const words = useMessages();

  /*
   * Parsed once per config, not once per render.
   *
   * The reader re-renders as the page scrolls — it tracks which section is in
   * view — and this used to hand every island a **freshly parsed `data`** each
   * time. Anything memoised on `data` therefore recomputed on every paint: a
   * reader reported a shuffled quiz visibly rearranging itself as they
   * scrolled, which is that, seen from the outside.
   *
   * The saving is incidental but real — a chess game's PGN was re-parsed from
   * JSON on every scroll frame too.
   */
  const parsed = useMemo(() => safeParse(config), [config]);

  if (!definition) {
    // The name is the author's problem, not the reader's, and `lint:content`
    // is what tells them — this can only be reached by an imported book, which
    // no linter gated. `IslandHostInline` has always done it this way.
    console.warn(`No island named "${type ?? '(none)'}" is registered for this book.`);
    return (
      <div className="island island--unknown" role="note">
        {words.islandBroken}
      </div>
    );
  }

  if (!trusted && definition.disabledWhenUntrusted) {
    return (
      <div className="island island--disabled" role="note">
        {words.islandBlocked}
      </div>
    );
  }

  const Component = definition.component;

  // Resolve `type: 'asset'` attributes here rather than in each island: this is
  // the only place that has both the declared schema and the book's resolver.
  // Blob URLs are per-reader and per-session, so it cannot happen at compile
  // time (SPEC001 P2.3 / L7).
  const attributes = { ...(parsed.attributes ?? {}) };
  const packagedAssets: string[] = [];

  for (const [name, spec] of Object.entries(definition.attributes ?? {})) {
    if (spec.type !== 'asset') continue;
    const value = attributes[name];
    if (typeof value !== 'string' || !value.startsWith('assets/')) continue;

    const url = resolveAsset?.(value);
    if (url) {
      attributes[name] = url;
      packagedAssets.push(name);
    }
  }

  return (
    <IslandBoundary type={type ?? 'island'}>
      <Suspense fallback={<div className="island island--loading" aria-busy="true" />}>
        <Component
          id={islandId ?? ''}
          attributes={attributes}
          packagedAssets={packagedAssets}
          data={parsed.data}
        >
          {children}
        </Component>
      </Suspense>
    </IslandBoundary>
  );
}
