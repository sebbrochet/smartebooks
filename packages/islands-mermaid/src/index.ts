import { lazy, type ComponentType } from 'react';
import {
  extractDirectiveCode,
  mdastToText,
  type IslandComponentProps,
  type IslandDefinition,
} from '@smart-ebooks/engine';

export interface MermaidIslandsOptions {
  /** This book's default diagram theme (a per-directive attribute wins). */
  theme?: string;
}

/**
 * `auto` follows the reader's light/dark setting, and is the default: a study
 * guide read at night should not show a white diagram on a dark page. The rest
 * are Mermaid's own themes, for a book that wants a fixed look.
 */
export const MERMAID_THEMES = ['auto', 'default', 'neutral', 'dark', 'forest', 'base'] as const;
export type MermaidTheme = (typeof MERMAID_THEMES)[number];

export const DEFAULT_THEME: MermaidTheme = 'auto';

/** The Mermaid theme to use when `auto` resolves against the reader's setting. */
export const AUTO_THEMES = { light: 'neutral', dark: 'dark' } as const;

/**
 * Whether `value` is a theme we ship. Book options are untrusted input — they
 * arrive from a descriptor inside a zip — so an unrecognised value must fall
 * back rather than reach Mermaid's configuration.
 */
export function resolveTheme(value: unknown, fallback: MermaidTheme = DEFAULT_THEME): MermaidTheme {
  return typeof value === 'string' && (MERMAID_THEMES as readonly string[]).includes(value)
    ? (value as MermaidTheme)
    : fallback;
}

/**
 * The Mermaid island for one book.
 *
 * Named after the notation rather than something generic like `diagram`,
 * because the body *is* Mermaid source: a `:::diagram` that only accepts one
 * syntax would be a leaky abstraction, and nothing else is on the roadmap.
 *
 * The component is lazy: Mermaid is a large dependency and should only reach
 * readers of books that actually draw something.
 */
export function mermaidIslands(options: MermaidIslandsOptions = {}): IslandDefinition[] {
  const bookTheme = resolveTheme(options?.theme);

  return [
    {
      name: 'mermaid',
      attributes: {
        // The book's own default becomes the schema default, so an invalid
        // per-directive value falls back to what this book chose.
        theme: { type: 'enum', values: MERMAID_THEMES, default: bookTheme },
        title: { type: 'string', default: '' },
      },
      component: lazy(
        (): Promise<{ default: ComponentType<IslandComponentProps> }> => import('./MermaidIsland'),
      ),
      // The diagram source is a fenced block in the body, like the chess pack's
      // PGN. Falling back to the plain text lets a fence-less body still work.
      extract: (node) => ({ code: extractDirectiveCode(node) ?? mdastToText(node) }),
      // Without JavaScript a diagram cannot be drawn, so exports get the source
      // as a code block: readable, and honest about what it is.
      fallback: (_node, data) => {
        const code = (data as { code?: string } | undefined)?.code ?? '';
        if (!code.trim()) return undefined;
        return [{ type: 'code', lang: 'mermaid', value: code }];
      },
    },
  ];
}
