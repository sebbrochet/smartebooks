import { useEffect, useState } from 'react';
import type { Book } from '../types';
import type { IslandRegistry } from '../islandRegistry';
import type { NavSection } from './navSections';
import { useMessages } from '../i18n/messages';
import { readPartProgress, type PartProgress } from '../store/bookProgress';
import { subscribeToStore } from '../store/store';

interface PartViewProps {
  book: Book;
  basePath: string;
  section: NavSection;
  registry: IslandRegistry;
}

/**
 * A part's landing page: its chapters, and how the reader is doing in each.
 *
 * SPEC002 N5 filed a part as "an inert heading", and R1.5e deferred the fix to
 * SPEC005 on the grounds that a part index is a content unit. That is true of
 * an **authored** part introduction, and this is not one: everything here is
 * derived from chapters that already exist, so it needs no new unit and no
 * decision from SPEC005. The authored half stays deferred.
 *
 * What it is for: the book that prompted it is a certification guide split
 * across two exam tracks, and "which track am I weak on" is the question its
 * reader has. The dashboard could only answer "you have taken 11 quizzes",
 * which is a fact about effort rather than about readiness.
 */
export function PartView({ book, basePath, section, registry }: PartViewProps) {
  const words = useMessages();
  const [progress, setProgress] = useState<PartProgress>();

  useEffect(() => {
    let active = true;
    const load = () =>
      readPartProgress(book, registry, section).then((next) => {
        if (active) setProgress(next);
      });
    void load();
    // Answering a quiz in a chapter listed here should change the figures
    // beside it without a reload.
    const unsubscribe = subscribeToStore(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [book, registry, section]);

  const chapters = progress?.chapters ?? [];

  return (
    <article className="part">
      <h1>{section.title}</h1>

      <p className="part__summary" role="status">
        {words.chapterCount(section.chapters.length)}
        {progress && progress.quizzes > 0 && (
          <>
            {' · '}
            {words.quizzesAnswered(progress.quizzesTaken, progress.quizzes)}
            {progress.quizzesTaken > 0 && (
              <>
                {' · '}
                <strong>{words.pointsScored(progress.score, progress.points)}</strong>
              </>
            )}
          </>
        )}
      </p>

      <ol className="part__chapters">
        {section.chapters.map((chapter) => {
          const row = chapters.find((entry) => entry.slug === chapter.slug);
          return (
            <li key={chapter.slug}>
              <a href={`#${basePath}/${chapter.slug}`}>{chapter.title}</a>
              {/* Rendered only once the figures are known: a chapter that
                  flashes "0 of 3" before the store answers reads as a result,
                  not as a pending one. */}
              {row && (
                <span className="part__chapter-score">
                  {row.quizzes === 0
                    ? words.noQuiz
                    : row.quizzesTaken === 0
                      ? words.pointsUnanswered(row.points)
                      : words.chapterScore(row.score, row.points, row.quizzesTaken, row.quizzes)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
