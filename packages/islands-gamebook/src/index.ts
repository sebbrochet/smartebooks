/**
 * The gamebook pack (SPEC011).
 *
 * The state model, the condition vocabulary and the linter's rules were all
 * settled before any markup, because all three are expensive to change once a
 * book exists: K2.7 decides what a visit costs, QG4 decides what a condition
 * may even be since the fallback has to print it, and K4 is the part that would
 * be hardest to retrofit (§8).
 */
import { lazy } from 'react';
import type { IslandDefinition } from '@smart-ebooks/engine';

export * from './journey';
export * from './condition';
export * from './check';
export { PLAY_KEY, journeyGate, take, usePlaythrough, usePlaythroughOf } from './playthrough';

const ChoiceIsland = lazy(() => import('./ChoiceIsland'));

/**
 * A gamebook's islands.
 *
 * Only `::choice` so far, and deliberately rather than partially: a gamebook is
 * choices plus prose, and `::dice`, `:::if` and the character sheet are worth
 * nothing until a book needs them — the argument §8.4 already makes for
 * `:::combat`.
 */
export function gamebookIslands(): IslandDefinition[] {
  return [
    {
      name: 'choice',
      // Written inside a sentence: "If you open the door, ::choice{to="45"}."
      inline: true,
      component: ChoiceIsland,
      attributes: {
        /** A section id in this book, never a URL — which the guided model exists to prevent. */
        to: { type: 'string' },
      },
      // `turn to 45` is the printed gamebook's own line, so this static form is
      // the source rather than a degradation of it (§5.1). Inline text, not a
      // paragraph: a choice sits inside the author's sentence.
      fallback: (_node, _data, ctx) => {
        const to = typeof ctx.attributes.to === 'string' ? ctx.attributes.to : '';
        return to ? [{ type: 'text', value: `turn to ${to}` }] : undefined;
      },
    },
  ];
}
