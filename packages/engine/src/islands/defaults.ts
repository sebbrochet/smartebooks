import type { IslandDefinition } from '../islandRegistry';
import { QuizIsland } from './QuizIsland';
import { CheckpointIsland } from './CheckpointIsland';
import { VideoIsland } from './VideoIsland';
import { FlashcardIsland } from './FlashcardIsland';
import { AudioIsland } from './AudioIsland';
import { MatchingPairsIsland } from './MatchingPairsIsland';
import { extractFlashcard, extractJsonConfig, extractQuiz } from '../markdown/extract';
import { checkpointFallback, flashcardFallback, quizFallback } from './fallbacks';

/**
 * The built-in island set. A book opts in by listing it in the `islands` it
 * declares (`makeBook(descriptor, modules, defaultIslands)`); a book that needs
 * none of these simply doesn't include them.
 */
export const defaultIslands: IslandDefinition[] = [
  {
    name: 'quiz',
    component: QuizIsland,
    extract: (node) => extractQuiz(node),
    fallback: quizFallback,
  },
  {
    name: 'checkpoint',
    component: CheckpointIsland,
    attributes: {
      label: { type: 'string', default: 'Mark this section as complete' },
    },
    fallback: checkpointFallback,
  },
  {
    name: 'video',
    component: VideoIsland,
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
    extract: (node) => extractFlashcard(node),
    fallback: flashcardFallback,
  },
  {
    name: 'audio',
    component: AudioIsland,
    attributes: {
      src: { type: 'asset', required: true },
      title: { type: 'string', default: 'Audio' },
    },
  },
  {
    name: 'matching-pairs',
    aliases: ['matchingpairs'],
    component: MatchingPairsIsland,
    extract: (node) => extractJsonConfig(node),
  },
];
