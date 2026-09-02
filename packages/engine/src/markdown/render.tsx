import { Fragment, type ReactNode } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeReact, { type Options as RehypeReactOptions } from 'rehype-react';
import { remarkIslands } from './remarkIslands';
import { rehypeCallouts } from './rehypeCallouts';
import { rehypeHeadingIds } from './rehypeHeadingIds';
import { rehypeHighlightTerms } from './rehypeHighlightTerms';
import { rehypeResolveAssets } from './rehypeResolveAssets';
import { IslandHost } from './IslandHost';
import { IslandHostInline } from './IslandHostInline';
import type { IslandRegistry } from '../islandRegistry';

const rehypeReactOptions = {
  Fragment,
  jsx,
  jsxs,
  components: {
    island: IslandHost,
    'island-inline': IslandHostInline,
  },
} as unknown as RehypeReactOptions;

// For untrusted (imported) content: sanitize the HTML but keep our neutral
// <island> elements (their interactive component decides how to treat its
// config). `island-inline` carries the authored label as children, so unlike
// `island` its content survives sanitising — which is fine: it is ordinary
// phrasing content and is sanitised like any other.
const untrustedSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'island', 'island-inline'],
  attributes: {
    ...defaultSchema.attributes,
    island: ['type', 'id', 'config'],
    'island-inline': ['type', 'id', 'config'],
  },
};

function buildProcessor(
  trusted: boolean,
  registry: IslandRegistry,
  resolveAsset?: (src: string) => string | undefined,
) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkIslands, registry)
    .use(remarkRehype);
  if (!trusted) processor.use(rehypeSanitize, untrustedSchema);
  // After sanitising, so a callout's class is something the tree earned rather
  // than something an imported book could have written for itself.
  processor.use(rehypeCallouts);
  processor.use(rehypeHeadingIds);
  // After the heading ids, so a marked term inside a heading cannot change the
  // text the slug was derived from.
  processor.use(rehypeHighlightTerms);
  if (resolveAsset) processor.use(rehypeResolveAssets, resolveAsset);
  return processor.use(rehypeReact, rehypeReactOptions);
}

type Processor = ReturnType<typeof buildProcessor>;

// Cache processors per registry (and trust level). The registry object identity
// is stable per book, so a book re-renders through the same cached processor.
const processorCache = new WeakMap<
  IslandRegistry,
  { trusted?: Processor; untrusted?: Processor }
>();

function cachedProcessor(trusted: boolean, registry: IslandRegistry): Processor {
  let entry = processorCache.get(registry);
  if (!entry) {
    entry = {};
    processorCache.set(registry, entry);
  }
  const key = trusted ? 'trusted' : 'untrusted';
  return (entry[key] ??= buildProcessor(trusted, registry));
}

export interface RenderOptions {
  /** Island lookup for this render — the set of islands the book declares. */
  registry: IslandRegistry;
  /** Trusted content skips sanitization. Imported books pass `false`. */
  trusted?: boolean;
  /** Resolve in-package `assets/…` references (e.g. to Blob URLs). */
  resolveAsset?: (src: string) => string | undefined;
  /**
   * Builds the href a heading's permalink points at, given its id.
   *
   * Supplied by the caller because only it knows the route: this app is
   * hash-routed, so a bare `href="#section"` would **replace** the route rather
   * than scroll within it — a link that looks right and navigates the reader
   * out of the chapter. Omit it and headings still get ids, just no anchor.
   */
  headingLink?: (id: string) => string;
  /**
   * Terms to mark in the prose, when the reader arrived from a search.
   *
   * Landing on the right section is only half an answer — the section is still
   * a screen of text with the word somewhere in it (SPEC002 N14).
   */
  highlightTerms?: string[];
}

/**
 * Render a Markdown string (with interactive directives) into a React node tree.
 * Prose becomes ordinary HTML elements; directives become interactive islands
 * looked up in the book's own registry. Untrusted content is HTML-sanitized
 * (dangerous links/tags removed).
 */
export function renderMarkdown(markdown: string, options: RenderOptions): ReactNode {
  const trusted = options.trusted ?? true;
  const { registry } = options;
  // Per-run data travels on the file rather than in a plugin's closure, so a
  // chapter's own link builder does not get baked into the cached processor and
  // then handed to the next chapter.
  const file = {
    value: markdown,
    data: { headingLink: options.headingLink, highlightTerms: options.highlightTerms },
  };

  if (options.resolveAsset) {
    return buildProcessor(trusted, registry, options.resolveAsset).processSync(file)
      .result as ReactNode;
  }
  return cachedProcessor(trusted, registry).processSync(file).result as ReactNode;
}
