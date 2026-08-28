import {
  defaultIslands,
  type IslandDefinition,
  type SmartbookDescriptor,
} from '@smart-ebooks/engine';
import { chessIslands, type ChessIslandsOptions } from '@smart-ebooks/islands-chess';
import { mermaidIslands, type MermaidIslandsOptions } from '@smart-ebooks/islands-mermaid';

/**
 * Maps an island **pack name** declared in a book's `smartbook.json` to the
 * code that provides it.
 *
 * This is the one place where a book's data meets an implementation, and it
 * lives in the platform rather than in the book. That is what lets a book be
 * pure data (`smartbook.json` + `content/` + `assets/`) with no TypeScript of
 * its own — so a generator, an agent, or a non-developer can write one.
 */
const packs: Record<string, (options: unknown) => IslandDefinition[]> = {
  chess: (options) => chessIslands((options ?? {}) as ChessIslandsOptions),
  mermaid: (options) => mermaidIslands((options ?? {}) as MermaidIslandsOptions),
};

/** Pack names this build can provide. */
export const availablePacks = Object.keys(packs);

/**
 * The islands a book may use: the built-ins, plus every pack it declares.
 * Books never receive islands they did not ask for.
 *
 * An unknown pack is a hard failure rather than a silent omission — the book
 * would otherwise render "Unknown interactive block" placeholders with no
 * explanation of why.
 */
export function resolveIslands(descriptor: SmartbookDescriptor): IslandDefinition[] {
  const declared = descriptor.islands?.packs ?? {};
  const extra = Object.entries(declared).flatMap(([name, options]) => {
    const factory = packs[name];
    if (!factory) {
      throw new Error(
        `Book "${descriptor.slug}" declares unknown island pack "${name}". ` +
          `Available: ${availablePacks.join(', ') || 'none'}.`,
      );
    }
    return factory(options);
  });

  return [...defaultIslands, ...extra];
}

/**
 * The islands an **imported** book may use.
 *
 * Same rule as `resolveIslands` — built-ins plus declared packs — but an
 * unknown pack is **omitted rather than thrown**. A bundled book is authored
 * here, so a bad pack name is a build error worth stopping for; an imported
 * package comes from elsewhere and may legitimately have been made against a
 * platform that ships packs this one does not. Throwing would take down the
 * whole shelf over one bad file.
 *
 * The book still gets an explanation: `islands.required` drives the reader's
 * "this book uses blocks this reader cannot display" notice (SPEC001 P2.1).
 *
 * **Pack options here are untrusted input** — they come from a descriptor
 * inside a zip. Packs must validate their own options against allow-lists
 * rather than trusting the declared shape; `islandPacks.test.ts` holds the
 * chess pack to that.
 */
export function resolveImportedIslands(descriptor: SmartbookDescriptor): IslandDefinition[] {
  const declared = descriptor.islands?.packs ?? {};
  const extra = Object.entries(declared).flatMap(([name, options]) => {
    const factory = packs[name];
    return factory ? factory(options) : [];
  });

  return [...defaultIslands, ...extra];
}
