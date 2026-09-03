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
 * `<island>` (or `<island-inline>`) hast element carrying `type`, `id`, and a
 * JSON `config`. If the directive's island is declared by the book (and has an
 * `extract`), its structured `data` is computed here; directives outside the
 * book's registry still become islands and render as a clear "unknown"
 * placeholder (so imported books degrade gracefully).
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

      const inline = directive.type === 'textDirective';

      directive.data = directive.data ?? {};
      // A separate element for inline islands, because the two cannot share a
      // renderer: a block island is a `div` and would be invalid inside the
      // paragraph a text directive lives in (SPEC001 P2.6 / L12).
      directive.data.hName = inline ? 'island-inline' : 'island';
      directive.data.hProperties = {
        type: name,
        // **Not `id`.** The sanitiser applied to imported books clobbers `id`
        // and `name` with a `user-content-` prefix, which is a real defence
        // for prose (an attacker-chosen `id` can shadow a DOM property) but
        // wrong here: this is not a DOM id, it is the key an island persists
        // the reader's answers under. Under the old name an imported book
        // silently saved to `score:user-content-ch1-basics`, so the same book
        // read bundled and read as a package kept two sets of progress and
        // nothing could join a score back to the chapter that earned it.
        islandId: attributes.id ?? '',
        config: JSON.stringify({ attributes: values, data }),
      };

      if (inline) {
        // The bracketed label **is** the content, and it is also the static
        // form: `:term[palimpsest]` with the interactivity stripped is the word
        // "palimpsest", which is exactly what an export wants. So an inline
        // island keeps its children and needs no `fallback` at all. Clearing
        // them — which this plugin used to do for all three directive types —
        // is what made text directives lose their label (L12).
        return;
      }

      // An island that renders its own body keeps it, for the same reason: the
      // author placed those paragraphs, and stripping the interactivity should
      // leave them where they were put (SPEC001 P2.10a). Note this is the whole
      // body, including any child directives — they are separate `<island>`
      // elements in the tree, which `remark-rehype` and the sanitiser already
      // handle.
      if (definition?.rendersChildren) return;

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
