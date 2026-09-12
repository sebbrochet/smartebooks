import { lazy, type ComponentType } from 'react';
import type { IslandDefinition } from '../islandRegistry';
import type { IslandComponentProps } from '../types';
import { QuizIsland } from './QuizIsland';
import { CheckpointIsland } from './CheckpointIsland';
import { VideoIsland } from './VideoIsland';
import { FlashcardIsland } from './FlashcardIsland';
import { AudioIsland } from './AudioIsland';
import { MatchingPairsIsland } from './MatchingPairsIsland';
import { TermIsland } from './TermIsland';
import {
  extractDirectiveCode,
  extractFlashcard,
  extractJsonConfig,
  extractQuiz,
} from '../markdown/extract';
import { checkpointFallback, flashcardFallback, quizFallback } from './fallbacks';
import { formatTime, parseMarks } from './timedMedia';

/**
 * The timed-media islands are **lazy**, unlike their neighbours, and the reason
 * is measured rather than assumed (SPEC012 decision 6).
 *
 * A book of linear fiction should not pay for a player it never uses. Measured
 * on 2026-09-11, video and audio together cost the entry chunk **0.77 kB
 * gzipped** of 174 kB — real, and far too small to justify a separate pack with
 * descriptor declarations and coverage plumbing. Lazy loading gets the same
 * property for the price of a wrapper, because `IslandHost` has always provided
 * the `Suspense` boundary that chess's components already rely on.
 *
 * The named-export dance is because these are `export function`s, where the
 * chess pack's are default exports.
 */
const lazily = (load: () => Promise<{ default: ComponentType<IslandComponentProps> }>) =>
  lazy(load);

const MediaLessonIsland = lazily(() => import('./MediaLessonIsland'));
const TimeMarkIsland = lazily(() => import('./TimeMarkIsland'));
const MediaMarksIsland = lazily(() => import('./MediaMarksIsland'));

/**
 * The built-in island set. A book opts in by listing it in the `islands` it
 * declares (`makeBook(descriptor, modules, defaultIslands)`); a book that needs
 * none of these simply doesn't include them.
 */
export const defaultIslands: IslandDefinition[] = [
  {
    name: 'quiz',
    component: QuizIsland,
    stateful: true,
    extract: (node) => extractQuiz(node),
    fallback: quizFallback,
  },
  {
    name: 'checkpoint',
    component: CheckpointIsland,
    stateful: true,
    attributes: {
      label: { type: 'string', default: 'Mark this section as complete' },
    },
    fallback: checkpointFallback,
  },
  {
    name: 'video',
    component: VideoIsland,
    stateful: true,
    // `src` is required: a video island with no source is an authoring mistake
    // worth catching at build time rather than rendering an empty player.
    attributes: {
      src: { type: 'asset', required: true },
      title: { type: 'string', default: 'Video' },
    },
  },
  {
    name: 'flashcard',
    component: FlashcardIsland,
    stateful: true,
    extract: (node) => extractFlashcard(node),
    fallback: flashcardFallback,
  },
  {
    name: 'audio',
    component: AudioIsland,
    stateful: true,
    attributes: {
      src: { type: 'asset', required: true },
      title: { type: 'string', default: 'Audio' },
    },
  },
  {
    name: 'matching-pairs',
    aliases: ['matchingpairs'],
    component: MatchingPairsIsland,
    stateful: true,
    extract: (node) => extractJsonConfig(node),
  },
  {
    // Written inside a sentence: `:term[palimpsest]{definition="…"}`.
    name: 'term',
    inline: true,
    component: TermIsland,
    attributes: {
      definition: { type: 'string', default: '' },
    },
    // No `fallback`: an inline island's children are its static form, and the
    // engine keeps them rather than replacing them.
  },
  {
    /*
     * A recording with the prose written around it, and moments in that prose
     * that drive it (SPEC012). The second consumer of `createSequence`, and the
     * test of whether that primitive was general or merely chess-shaped.
     */
    name: 'media-lesson',
    aliases: ['medialesson'],
    component: MediaLessonIsland,
    rendersChildren: true,
    attributes: {
      src: { type: 'asset', required: true },
      poster: { type: 'asset' },
    },
    // The marks are the container's data, the way a PGN is a game's: the author
    // declares them once, `::media-marks` prints them and `:at[…]` resolves
    // against them (see `parseMarks`).
    extract: (node) => ({ marks: parseMarks(extractDirectiveCode(node) ?? '') }),
    /*
     * A timecoded index is not an approximation of a book written around a
     * recording — it *is* one, and it is how such books have always been set.
     * So the static form is the marks, in order, as a list (SPEC001 P1.1).
     */
    fallback: (_node, data) => {
      const marks = (data as { marks?: { at: number; label: string }[] })?.marks ?? [];
      if (marks.length === 0) return undefined;

      return [
        {
          type: 'list' as const,
          ordered: false,
          spread: false,
          children: marks.map((mark) => ({
            type: 'listItem' as const,
            spread: false,
            children: [
              {
                type: 'paragraph' as const,
                children: [
                  {
                    type: 'strong' as const,
                    children: [{ type: 'text' as const, value: formatTime(mark.at) }],
                  },
                  { type: 'text' as const, value: ` — ${mark.label}` },
                ],
              },
            ],
          })),
        },
      ];
    },
  },
  {
    // `:at[1:24]` — a moment named inside a sentence.
    name: 'at',
    inline: true,
    component: TimeMarkIsland,
  },
  {
    name: 'media-marks',
    aliases: ['mediamarks'],
    component: MediaMarksIsland,
  },
];
