import { useEffect, useState } from 'react';
import { readBookStats, subscribeToStore, type BookStats } from '../store/store';
import { useBook } from '../reader/BookContext';

/**
 * A live summary of the reader's local progress and quiz points for the current
 * book. Reloads whenever any island writes to the store (via the subscription).
 */
export function ProgressDashboard() {
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
        <strong>{stats.sectionsComplete}</strong> sections done
      </span>
      <span className="dashboard__stat">
        <strong>
          {stats.quizScore}/{stats.quizTotal}
        </strong>{' '}
        quiz points
      </span>
      <span className="dashboard__stat">
        <strong>{stats.quizzesTaken}</strong> quizzes taken
      </span>
    </div>
  );
}
