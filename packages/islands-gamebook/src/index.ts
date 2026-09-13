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
export * from './bookGraph';
export { PLAY_KEY, take, usePlaythrough, usePlaythroughOf } from './playthrough';

const ChoiceIsland = lazy(() => import('./ChoiceIsland'));
const RestartIsland = lazy(() => import('./RestartIsland'));
const JourneysIsland = lazy(() => import('./JourneysIsland'));
const EndingIsland = lazy(() => import('./EndingIsland'));
const DeathIsland = lazy(() => import('./DeathIsland'));

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
    {
      name: 'restart',
      // Written inside a sentence, at an ending: "Or :restart{to="1"}."
      inline: true,
      component: RestartIsland,
      attributes: {
        /** Where a new attempt begins — usually, but not necessarily, section one. */
        to: { type: 'string' },
      },
      // A printed book says it in the same breath as the ending.
      fallback: (_node, _data, ctx) => {
        const to = typeof ctx.attributes.to === 'string' ? ctx.attributes.to : '';
        return to ? [{ type: 'text', value: `begin again at ${to}` }] : undefined;
      },
    },
    {
      name: 'journeys',
      component: JourneysIsland,
      attributes: {},
      // No static form, and that is a legitimate answer (SPEC003 QD5): this is
      // a record of one reader's play, and a printed page has no reader.
      fallback: () => undefined,
    },
    {
      name: 'ending',
      inline: true,
      component: EndingIsland,
      attributes: {},
    },
    {
      name: 'death',
      inline: true,
      component: DeathIsland,
      attributes: {
        /** Where the reader picks the story up again (QG11). */
        to: { type: 'string' },
      },
      // How a printed gamebook types it.
      fallback: (_node, _data, ctx) => {
        const to = typeof ctx.attributes.to === 'string' ? ctx.attributes.to : '';
        return to ? [{ type: 'text', value: `return to ${to}` }] : undefined;
      },
    },
  ];
}
