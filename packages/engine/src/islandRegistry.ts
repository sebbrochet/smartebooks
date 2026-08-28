import type { IslandComponent } from './types';

/** An mdast directive node passed to an island's `extract` function. */
export type DirectiveNode = unknown;

export interface IslandDefinition {
  /** Canonical directive name, kebab-case, e.g. `quiz` or `chess-board`. */
  name: string;
  /**
   * Older spellings that still resolve to this island, e.g. `chessboard`.
   * Content published before a rename keeps working; the content linter warns
   * so books migrate over time rather than breaking at once.
   */
  aliases?: string[];
  /** The React component that renders the island. May be `React.lazy(...)`. */
  component: IslandComponent;
  /**
   * Optional: pre-parse the directive body into structured `data` at parse
   * time (runs in the Markdown pipeline). Use engine helpers such as
   * `extractDirectiveCode` / `mdastToText` to read the body without pulling
   * heavy dependencies into the parse step.
   */
  extract?: (node: DirectiveNode) => unknown;
  /** If true, the island is replaced by a notice in untrusted (imported) books. */
  disabledWhenUntrusted?: boolean;
}

// Islands are never registered globally: every book declares the exact set it
// uses, and the engine builds an isolated registry from that list. This keeps
// the authoring vocabulary explicit per book and avoids order-dependent global
// state (a book can't accidentally rely on an island another book contributed).

/**
 * A read-only island lookup, scoped to one book.
 */
export interface IslandRegistry {
  /** Resolve a directive name, canonical or aliased. */
  get(name: string): IslandDefinition | undefined;
  /** The canonical vocabulary of this book. Aliases are accepted, not listed. */
  names(): string[];
}

/** Builds an isolated registry from the definitions a book declares. */
export function createIslandRegistry(definitions: IslandDefinition[]): IslandRegistry {
  const map = new Map<string, IslandDefinition>();
  for (const definition of definitions) {
    map.set(definition.name, definition);
    // Canonical names win: an alias never shadows a real island's name.
    for (const alias of definition.aliases ?? []) {
      if (!map.has(alias)) map.set(alias, definition);
    }
  }

  return {
    get: (name) => map.get(name),
    names: () => definitions.map((definition) => definition.name),
  };
}
