import type { Book } from '../types';
import type { IslandRegistry } from '../islandRegistry';
import { chapterScorables } from '../markdown/scorables';
import { navSections, type NavSection } from '../reader/navSections';
import { loadState, type CheckpointState, type QuizScore } from './store';

/** One chapter's measured progress: what it asks, and what the reader answered. */
export interface ChapterProgress {
  slug: string;
  title: string;
  /** Quizzes in the chapter, and how many have been submitted at least once. */
  quizzes: number;
  quizzesTaken: number;
  /** Points scored, out of every point the chapter's quizzes are worth. */
  score: number;
  points: number;
  checkpoints: number;
  checkpointsComplete: number;
}

/** A part, its chapters, and the same figures summed over them. */
export interface PartProgress {
  id?: string;
  title?: string;
  chapters: ChapterProgress[];
  score: number;
  points: number;
  quizzes: number;
  quizzesTaken: number;
}

function empty(id: string | undefined, title: string | undefined): PartProgress {
  return { id, title, chapters: [], score: 0, points: 0, quizzes: 0, quizzesTaken: 0 };
}

/**
 * The reader's progress through one part, chapter by chapter.
 *
 * `readBookStats` answers "how many quizzes have you taken in this book"; this
 * answers "how did you do in *this* part", which is the question a study guide
 * split across two exam tracks is actually asked. The difference is the join:
 * a score is stored under the quiz's id, and only the Markdown knows which
 * chapter that quiz sits in.
 *
 * Reads are per key rather than one scan of the whole store. A part is a
 * handful of chapters holding a handful of quizzes, and `loadState` is the same
 * path every island already uses — `entries()` would pull every book's state
 * into memory to answer a question about five chapters.
 */
export async function readPartProgress(
  book: Book,
  registry: IslandRegistry,
  section: NavSection,
): Promise<PartProgress> {
  const part = empty(section.id, section.title);

  for (const chapter of section.chapters) {
    const scorables = chapterScorables(chapter.markdown, registry);
    const row: ChapterProgress = {
      slug: chapter.slug,
      title: chapter.title,
      quizzes: 0,
      quizzesTaken: 0,
      score: 0,
      points: 0,
      checkpoints: 0,
      checkpointsComplete: 0,
    };

    for (const scorable of scorables) {
      if (scorable.kind === 'quiz') {
        row.quizzes++;
        row.points += scorable.points;
        const saved = await loadState<QuizScore | undefined>(
          book.meta.slug,
          `score:${scorable.id}`,
          undefined,
        );
        if (saved) {
          row.quizzesTaken++;
          // Clamped to what the chapter is worth **now**, not to the `total`
          // the score was recorded against. A quiz that has since lost a
          // question leaves a stored 4-out-of-4 behind, and reporting it
          // against the current three would print 4/3 — at which point the
          // reader is entitled to disbelieve every other figure on the page.
          row.score += Math.min(saved.score, scorable.points);
        }
        continue;
      }

      row.checkpoints++;
      const saved = await loadState<CheckpointState | undefined>(
        book.meta.slug,
        `progress:${scorable.id}`,
        undefined,
      );
      if (saved?.complete) row.checkpointsComplete++;
    }

    part.chapters.push(row);
    part.score += row.score;
    part.points += row.points;
    part.quizzes += row.quizzes;
    part.quizzesTaken += row.quizzesTaken;
  }

  return part;
}

/** Find the section a part id names, or `undefined` if the book has no such part. */
export function findSection(book: Book, partId: string): NavSection | undefined {
  return navSections(book.chapters, book.descriptor.parts).find((section) => section.id === partId);
}
