import { Suspense, type ReactNode } from 'react';
import { useBook } from '../reader/BookContext';
import { IslandBoundary } from './IslandBoundary';
import type { AttributeValue } from '../islands/attributes';

interface IslandHostInlineProps {
  type?: string;
  /** The island's persistence key. Named to survive sanitising — see `remarkIslands`. */
  islandId?: string;
  config?: string;
  /** The bracketed label: `:term[palimpsest]` → `palimpsest`. */
  children?: ReactNode;
}

/**
 * Mounts an **inline** island — one authored as a text directive inside a
 * sentence (SPEC001 P2.6).
 *
 * Separate from `IslandHost` because the two cannot share a renderer: a block
 * island is a `div`, and a `div` inside the paragraph a text directive lives in
 * is invalid HTML. Everything else is deliberately the same.
 *
 * The failure mode is the important part. Fiction, chess and travel guides all
 * want inline marks *inside prose*, so a broken one must not put a grey box in
 * the middle of a sentence: an unknown name, or a block island written as a
 * text directive, renders **the label alone**. The reader sees the word; the
 * content linter is what tells the author (SPEC001 P1.3).
 */
export function IslandHostInline({ type, islandId, config, children }: IslandHostInlineProps) {
  const { trusted, registry } = useBook();
  const definition = type ? registry.get(type) : undefined;

  if (!definition?.inline || (!trusted && definition.disabledWhenUntrusted)) {
    return <>{children}</>;
  }

  const parsed = safeParse(config);
  const Component = definition.component;

  return (
    <IslandBoundary type={type ?? 'island'} inline>
      <Suspense fallback={<>{children}</>}>
        <Component
          id={islandId ?? ''}
          attributes={parsed.attributes ?? {}}
          packagedAssets={[]}
          data={parsed.data}
        >
          {children}
        </Component>
      </Suspense>
    </IslandBoundary>
  );
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
