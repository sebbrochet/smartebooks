import { visit } from 'unist-util-visit';

type Tree = Parameters<typeof visit>[0];

interface HastElement {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
}

/**
 * Rewrite in-package asset references (e.g. `img src="assets/cover.png"`) to the
 * URLs returned by `resolveAsset` (Blob URLs for imported books). Runs after
 * sanitization so the injected Blob URL is never stripped.
 */
export function rehypeResolveAssets(resolveAsset: (src: string) => string | undefined) {
  return (tree: unknown) => {
    visit(tree as Tree, (node) => {
      const element = node as unknown as HastElement;
      if (
        element.type === 'element' &&
        (element.tagName === 'img' || element.tagName === 'source') &&
        element.properties
      ) {
        const src = element.properties.src;
        if (typeof src === 'string') {
          const resolved = resolveAsset(src);
          if (resolved) element.properties.src = resolved;
        }
      }
    });
  };
}
