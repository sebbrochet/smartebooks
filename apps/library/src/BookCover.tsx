import { useAssetResolver, type Book } from '@smart-ebooks/engine';

/**
 * Stable hue from the slug, so a book without artwork always gets the same
 * generated cover. Spread with the golden angle so similar slugs still land on
 * clearly different colours.
 */
function hueFor(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return Math.round(Math.abs(hash) * 137.508) % 360;
}

interface BookCoverProps {
  book: Book;
  /** `large` is used for the resume splash; the shelf uses the default. */
  size?: 'small' | 'large';
}

/**
 * A book's cover: its artwork when the book packages one, otherwise a generated
 * title card. Packaged bytes are resolved to Blob URLs by the engine resolver
 * (which sets the right MIME type — SVG covers need it); anything else is used
 * as a plain URL. Decorative — the accessible name comes from the surrounding
 * link/heading, so this is hidden from assistive tech.
 */
export function BookCover({ book, size = 'small' }: BookCoverProps) {
  const resolveAsset = useAssetResolver(book.assets);
  const path = book.meta.cover;
  const src = path ? (resolveAsset?.(path) ?? path) : undefined;
  const className = `bookcover bookcover--${size}`;

  if (src) {
    return <img className={className} src={src} alt="" aria-hidden="true" />;
  }

  return (
    <div
      className={`${className} bookcover--generated`}
      aria-hidden="true"
      style={{ '--cover-hue': hueFor(book.meta.slug) } as React.CSSProperties}
    >
      <span className="bookcover__title">{book.meta.title}</span>
      {book.meta.authors?.length ? (
        <span className="bookcover__author">{book.meta.authors.join(', ')}</span>
      ) : null}
    </div>
  );
}
