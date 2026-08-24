import { Suspense, type ReactNode } from 'react';
import { useBook } from '../reader/BookContext';

interface IslandHostProps {
  type?: string;
  id?: string;
  config?: string;
  children?: ReactNode;
}

interface ParsedConfig {
  attributes?: Record<string, string>;
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
  const { trusted, registry } = useBook();
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
  return (
    <Suspense fallback={<div className="island island--loading" aria-busy="true" />}>
      <Component id={id ?? ''} attributes={parsed.attributes ?? {}} data={parsed.data} />
    </Suspense>
  );
}
