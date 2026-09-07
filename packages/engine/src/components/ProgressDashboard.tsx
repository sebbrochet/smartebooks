import { useEffect, useState } from 'react';
import { readBookStats, subscribeToStore, type BookStats } from '../store/store';
import { useBook } from '../reader/BookContext';
import type { BookTotals } from '../markdown/scorables';

interface ProgressDashboardProps {
  /** The book's own denominators, from its content (SPEC009 T12). */
  totals: BookTotals;
}

/**
 * A live summary of the reader's local progress and quiz points for the current
 * book. Reloads whenever any island writes to the store (via the subscription).
 *
 * **Three cells in a grid, value over caption.** Written as a sentence per stat
 * it wrapped to two rows on every phone — 90px instead of 50px, measured at
 * 320–420px — and it wrapped because the stats are sized by their text, not by
 * the viewport. A grid is one row structurally rather than by hoping the words
 * fit, which matters when the words contain numbers that grow: `8/10` becomes
 * `128/150` in a long book.
 */
export function ProgressDashboard({ totals }: ProgressDashboardProps) {
  const { slug } = useBook();
  const [stats, setStats] = useState<BookStats | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      readBookStats(slug).then((next) => {
        if (active) setStats(next);
      });
    load();
    const unsubscribe = subscribeToStore(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [slug]);

  if (!stats) return null;

  return (
    <div className="dashboard" role="status" aria-label="Your progress">
      <span className="dashboard__stat">
        <strong className="dashboard__value">
          {stats.sectionsComplete}/{totals.sections}
        </strong>
        <span className="dashboard__label">sections</span>
      </span>
      <span className="dashboard__stat">
        {/*
         * Out of the book, not out of what has been attempted. `readBookStats`
         * can only add up quizzes already taken, so its total climbed as the
         * reader answered — a denominator that moves describes no progress.
         */}
        <strong className="dashboard__value">
          {stats.quizScore}/{totals.points}
        </strong>
        <span className="dashboard__label">points</span>
      </span>
      <span className="dashboard__stat">
        <strong className="dashboard__value">{stats.quizzesTaken}</strong>
        <span className="dashboard__label">quizzes</span>
      </span>
    </div>
  );
}
