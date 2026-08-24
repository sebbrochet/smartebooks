import { useEffect, useRef } from 'react';
import type { Book } from '@smart-ebooks/engine';
import { BookCover } from './BookCover';
import { hashFor } from './launch';

const SPLASH_MS = 1800;

interface CoverSplashProps {
  book: Book;
  chapterSlug?: string;
  onDismiss: () => void;
}

/**
 * Brief cover card shown before resuming the last book (the `cover` resume
 * mode). Always skippable — any click or key continues immediately, and a
 * visible link goes to the library instead, so the reader is never trapped
 * behind an animation.
 */
export function CoverSplash({ book, chapterSlug, onDismiss }: CoverSplashProps) {
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function go() {
      window.location.replace(hashFor(book.meta.slug, chapterSlug));
      onDismiss();
    }
    const timer = window.setTimeout(go, SPLASH_MS);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        window.clearTimeout(timer);
        onDismiss();
        return;
      }
      window.clearTimeout(timer);
      go();
    }
    window.addEventListener('keydown', onKey);
    skipRef.current?.focus();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [book.meta.slug, chapterSlug, onDismiss]);

  return (
    <main id="main" className="splash" data-testid="cover-splash">
      <div className="splash__card">
        <BookCover book={book} size="large" />
        <p className="splash__status" role="status">
          Resuming <strong>{book.meta.title}</strong>…
        </p>
        <div className="splash__actions">
          <button
            type="button"
            ref={skipRef}
            className="splash__skip"
            onClick={() => {
              window.location.replace(hashFor(book.meta.slug, chapterSlug));
              onDismiss();
            }}
          >
            Continue now
          </button>
          <button type="button" className="splash__library" onClick={onDismiss}>
            Go to library instead
          </button>
        </div>
      </div>
    </main>
  );
}
