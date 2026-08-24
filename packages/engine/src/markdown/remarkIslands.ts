import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { IslandRegistry } from '../islandRegistry';

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

      directive.data = directive.data ?? {};
      directive.data.hName = 'island';
      directive.data.hProperties = {
        type: name,
        id: attributes.id ?? '',
        config: JSON.stringify({ attributes, data }),
      };

      // Islands render from `config`; drop the original children so prose
      // fragments aren't duplicated inside the mounted component.
      directive.children = [];
    });
  };
}
