import {
  defaultIslands,
  type IslandDefinition,
  type SmartbookDescriptor,
} from '@smart-ebooks/engine';
import { chessIslands, type ChessIslandsOptions } from '@smart-ebooks/islands-chess';

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
