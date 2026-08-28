import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { IslandRegistry } from '../islandRegistry';
import { resolveAttributes } from '../islands/attributes';

interface DirectiveNode {
  type: string;
  name: string;
  attributes?: Record<string, string | null | undefined>;
  children?: unknown[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

/**
 * Remark plugin: rewrites every container/leaf/text directive into a neutral
 * `<island>` hast element carrying `type`, `id`, and a JSON `config`. If the
 * directive's island is declared by the book (and has an `extract`), its
 * structured `data` is computed here; directives outside the book's registry
 * still become islands and render as a clear "unknown" placeholder (so imported
 * books degrade gracefully).
 *
 * Prose is untouched — only directive nodes become interactive islands.
 */
export function remarkIslands(registry: IslandRegistry) {
  return (tree: Root) => {
    visit(tree, (node) => {
      const directive = node as unknown as DirectiveNode;
      if (
        directive.type !== 'containerDirective' &&
        directive.type !== 'leafDirective' &&
        directive.type !== 'textDirective'
      ) {
        return;
      }

      const name = directive.name;
      const attributes: Record<string, string> = {};
      for (const [key, value] of Object.entries(directive.attributes ?? {})) {
        if (typeof value === 'string') attributes[key] = value;
      }

      const definition = registry.get(name);
      const data = definition?.extract ? definition.extract(directive) : undefined;

      // Apply the island's declared schema here, once, at compile time: the
      // component then receives coerced, defaulted values. Problems are not
      // thrown — a bad attribute falls back to its default so a typo cannot
      // break a page for a reader. The content linter is what reports them.
      const { values } = resolveAttributes(definition?.attributes, attributes);

      directive.data = directive.data ?? {};
      directive.data.hName = 'island';
      directive.data.hProperties = {
        type: name,
        id: attributes.id ?? '',
        config: JSON.stringify({ attributes: values, data }),
      };

      // The authored body is replaced by the island's static form, so the
      // compiled document still says what this island is when the
      // interactivity is stripped. `IslandHost` ignores these children and
      // mounts the component; an exporter does the opposite (SPEC001 P1.1).
      //
      // The raw body is *not* kept: for data-bodied islands it is a JSON or PGN
      // blob, and printing that is worse than printing nothing.
      directive.children = definition?.fallback?.(directive, data, { attributes: values }) ?? [];
    });
  };
}
