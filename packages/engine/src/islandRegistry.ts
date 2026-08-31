import type { IslandComponent } from './types';
import type { AttributeSpec, AttributeValue } from './islands/attributes';
import type { RootContent } from 'mdast';

/**
 * What a `fallback` is given besides the node and its data.
 *
 * Only the resolved attributes for now. Islands whose printed form is an image
 * (a chess diagram, an engraved score) will need a way to emit a build-time
 * asset here; that waits on a real exporter to render against (SPEC001 P1.1).
 */
export interface FallbackContext {
  /** Attributes after the island's declared schema has been applied. */
  attributes: Record<string, AttributeValue>;
}

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
   * Declared attribute shape. The engine coerces and defaults centrally, so an
   * island receives validated values instead of re-checking strings itself —
   * and the content linter can flag a bad attribute before publication.
   * Attributes not listed here reach the component untouched, as strings.
   */
  attributes?: Record<string, AttributeSpec>;
  /**
   * Optional: pre-parse the directive body into structured `data` at parse
   * time (runs in the Markdown pipeline). Use engine helpers such as
   * `extractDirectiveCode` / `mdastToText` to read the body without pulling
   * heavy dependencies into the parse step.
   */
  extract?: (node: DirectiveNode) => unknown;
  /**
   * Static, export-safe content for this island: what it becomes when the
   * interactivity is stripped (print, EPUB, no-JS, search indexing).
   *
   * Runs at compile time; the result is placed in the `<island>` element's
   * children, which `IslandHost` ignores and an exporter renders. Returning
   * nothing means the island simply does not appear in exports.
   */
  fallback?: (
    node: DirectiveNode,
    data: unknown,
    ctx: FallbackContext,
  ) => RootContent[] | undefined;
  /** If true, the island is replaced by a notice in untrusted (imported) books. */
  disabledWhenUntrusted?: boolean;
  /**
   * This island is authored as a **text directive** — `:term[palimpsest]` — and
   * renders inside the sentence rather than as a block (SPEC001 P2.6).
   *
   * Its bracketed label arrives as `children` and is also its static form, so
   * an inline island needs no `fallback`: stripped of interactivity it is the
   * word the author wrote, which is exactly what an export wants.
   */
  inline?: true;
  /**
   * This island renders its own body (SPEC001 P2.10a). The authored children
   * are compiled and handed to the component instead of being replaced by a
   * `fallback` — so the author, not the island, decides where the prose goes
   * and what sits between the paragraphs.
   *
   * The body is therefore also the static form, which is why such an island
   * needs no `fallback`. Two rules come with it:
   *
   * - **Render children lazily, never hide them with CSS.** A concealed
   *   `chess-analysis` would still boot a 7 MB engine nobody asked for.
   * - **Consume any configuration block** (`extractDirectiveCode(node, {
   *   consume: true })`), or the reader sees the raw PGN or JSON above the
   *   island that was configured by it.
   */
  rendersChildren?: true;
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
