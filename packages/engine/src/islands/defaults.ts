import type { IslandDefinition } from '../islandRegistry';
import { QuizIsland } from './QuizIsland';
import { CheckpointIsland } from './CheckpointIsland';
import { VideoIsland } from './VideoIsland';
import { FlashcardIsland } from './FlashcardIsland';
import { AudioIsland } from './AudioIsland';
import { MatchingPairsIsland } from './MatchingPairsIsland';
import { extractFlashcard, extractJsonConfig, extractQuiz } from '../markdown/extract';

/**
 * The built-in island set. A book opts in by listing it in the `islands` it
 * declares (`makeBook(descriptor, modules, defaultIslands)`); a book that needs
 * none of these simply doesn't include them.
 */
export const defaultIslands: IslandDefinition[] = [
  { name: 'quiz', component: QuizIsland, extract: (node) => extractQuiz(node) },
  { name: 'checkpoint', component: CheckpointIsland },
  { name: 'video', component: VideoIsland },
  { name: 'flashcard', component: FlashcardIsland, extract: (node) => extractFlashcard(node) },
  { name: 'audio', component: AudioIsland },
  {
    name: 'matchingpairs',
    component: MatchingPairsIsland,
    extract: (node) => extractJsonConfig(node),
  },
];
