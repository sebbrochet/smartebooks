import { Suspense, type ReactNode } from 'react';
import { useBook } from '../reader/BookContext';
import type { AttributeValue } from '../islands/attributes';

interface IslandHostProps {
  type?: string;
  id?: string;
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
 * Maps a neutral `<island type=… id=… config=…>` element (produced by
 * remarkIslands) to one of the islands the book declares. Directives outside the
 * book's registry render a visible placeholder; components may be lazy (wrapped
 * in Suspense).
 */
export function IslandHost({ type, id, config }: IslandHostProps) {
  const { trusted, registry, resolveAsset } = useBook();
  const definition = type ? registry.get(type) : undefined;
  const parsed = safeParse(config);

  if (!definition) {
    return (
      <div className="island island--unknown" role="note">
        Unknown interactive block: <code>{type ?? '(none)'}</code>
      </div>
    );
  }

  if (!trusted && definition.disabledWhenUntrusted) {
    return (
      <div className="island island--disabled" role="note">
        Interactive <code>{type}</code> is disabled in imported books.
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
    <Suspense fallback={<div className="island island--loading" aria-busy="true" />}>
      <Component
        id={id ?? ''}
        attributes={attributes}
        packagedAssets={packagedAssets}
        data={parsed.data}
      />
    </Suspense>
  );
}
